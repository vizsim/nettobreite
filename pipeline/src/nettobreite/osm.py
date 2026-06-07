"""OSM-Highways: Geofabrik-PBF laden, mit osmium auf relevante highway-Klassen
vorfiltern, dann die Linien DIREKT mit pyogrio (GDAL-OSM-Treiber, osmconf via
OSM_CONFIG_FILE) nach FlatGeobuf schreiben. Kein ogr2ogr/GPKG/GeoJSON.

`<region>_highways.fgb` (data/raw/osm/) ist das Zwischenprodukt für width.py
(Phase 2). Region kommt aus regions.yaml, der Highway-Filter aus osm.yaml.
osmium wird bei dry_run oder fehlendem Binary nur ausgegeben.
"""

from __future__ import annotations

import os
import subprocess
from pathlib import Path
from shutil import which
from typing import Any

import requests

from nettobreite.config import get_paths, load_yaml

_OSM_CFG = "osm.yaml"
_REGIONS_CFG = "regions.yaml"


def _region_spec(region: str) -> dict[str, Any]:
    regions = load_yaml(_REGIONS_CFG).get("regions", {})
    if region not in regions:
        raise KeyError(f"Region '{region}' fehlt in regions.yaml. Verfügbar: {sorted(regions)}")
    return regions[region]


def _highways_cfg() -> dict[str, Any]:
    return load_yaml(_OSM_CFG)["highways"]


def _osmconf_path(name: str) -> Path:
    return get_paths().config / "osmconf" / name


def _raw() -> Path:
    return get_paths().raw / "osm"


def _run(cmd: list[str], *, dry_run: bool) -> None:
    printable = " ".join(cmd)
    if dry_run or which(cmd[0]) is None:
        reason = "dry-run" if dry_run else f"'{cmd[0]}' nicht installiert"
        print(f"  [{reason}] {printable}")
        return
    print(f"  $ {printable}")
    subprocess.run(cmd, check=True)


def fetch(region: str, *, force: bool = False) -> Path:
    """Lädt die Region-PBF von Geofabrik nach data/raw/osm/<pbf>."""
    spec = _region_spec(region)
    _raw().mkdir(parents=True, exist_ok=True)
    dest = _raw() / spec["pbf"]
    if dest.exists() and not force:
        print(f"  vorhanden: {dest}")
        return dest
    print(f"  lade {spec['url']}")
    with requests.get(spec["url"], stream=True, timeout=600) as resp:
        resp.raise_for_status()
        with open(dest, "wb") as fh:
            for chunk in resp.iter_content(chunk_size=1 << 20):
                fh.write(chunk)
    return dest


def data_date(pbf: Path) -> str | None:
    """Datenstand der PBF via `osmium fileinfo` (YYYY-MM-DD). None wenn nicht ermittelbar."""
    if which("osmium") is None or not pbf.exists():
        return None
    out = subprocess.run(
        ["osmium", "fileinfo", "-e", "-g", "data.timestamp.last", str(pbf)],
        check=True, capture_output=True, text=True,
    ).stdout.strip()
    return out[:10] or None  # "2025-11-09T..." -> "2025-11-09"


def tags_filter(pbf: Path, expressions: list[str], out_pbf: Path, *, dry_run: bool = False) -> Path:
    """osmium tags-filter (streaming) -> Kategorie-PBF."""
    out_pbf.parent.mkdir(parents=True, exist_ok=True)
    cmd = ["osmium", "tags-filter", "--overwrite", str(pbf), *expressions, "-o", str(out_pbf)]
    _run(cmd, dry_run=dry_run)
    return out_pbf


def pbf_lines_to_fgb(pbf: Path, fgb: Path, layers: list[str], osmconf: str | None = None) -> Path:
    """Liest die OSM-`lines` DIREKT aus der gefilterten PBF (GDAL-OSM-Treiber via
    pyogrio) und schreibt FlatGeobuf. Kein ogr2ogr/GPKG-Zwischenschritt.

    Wichtig: OGR_INTERLEAVED_READING NICHT auf YES zwingen (Default liefert die
    Features, YES → 0). `osmconf` wird via OSM_CONFIG_FILE beim Lesen angewandt.
    """
    import geopandas as gpd
    import pandas as pd
    from pyogrio import list_layers, read_dataframe

    env_key = "OSM_CONFIG_FILE"
    prev = os.environ.get(env_key)
    if osmconf:
        os.environ[env_key] = str(_osmconf_path(osmconf))
    try:
        available = {row[0] for row in list_layers(pbf)}
        frames = [read_dataframe(pbf, layer=lyr) for lyr in layers if lyr in available]
    finally:
        if osmconf:
            if prev is None:
                os.environ.pop(env_key, None)
            else:
                os.environ[env_key] = prev

    frames = [f for f in frames if len(f)]
    if not frames:
        raise ValueError(f"Keine Features in {pbf} (Layer {layers})")
    merged = gpd.GeoDataFrame(pd.concat(frames, ignore_index=True), crs=frames[0].crs)
    fgb.parent.mkdir(parents=True, exist_ok=True)
    merged.to_file(fgb, driver="FlatGeobuf")
    return fgb


def build(region: str, *, dry_run: bool = False) -> Path:
    """Geofabrik-PBF -> osmium tags-filter -> pyogrio (direkt PBF->FGB).

    Setzt eine vorhandene Region-PBF voraus (sonst erst `nettobreite osm fetch`).
    Liefert data/raw/osm/<region>_highways.fgb.
    """
    spec = _region_spec(region)
    hw = _highways_cfg()
    pbf = _raw() / spec["pbf"]
    if not dry_run and not pbf.exists():
        raise FileNotFoundError(
            f"PBF fehlt: {pbf} — erst `nettobreite osm fetch --region {region}`."
        )

    cat_pbf = tags_filter(
        pbf, hw["osmium_filter"], _raw() / f"{region}_highways.osm.pbf", dry_run=dry_run
    )
    fgb = _raw() / f"{region}_highways.fgb"
    if dry_run or not cat_pbf.exists():
        print(f"  [skip] {hw['osm_layers']} -> {fgb.name} direkt (kein PBF / dry-run)")
        return fgb
    return pbf_lines_to_fgb(cat_pbf, fgb, hw["osm_layers"], hw.get("osmconf"))
