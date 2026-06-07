"""Generiert data/manifest.json: Index + Datenstand je Quelle.

Das Frontend liest die Datei einmal: (a) welche Layer es gibt und welche Datei
dazugehört, (b) den Datenstand (`vintage`) je Layer für die „Stand:"-Anzeige.
Gespeist aus der handgepflegten config/sources.yaml; `date: auto` wird hier via
`osmium fileinfo` der Region-PBF aufgelöst.
"""

from __future__ import annotations

import json
from datetime import date
from pathlib import Path
from typing import Any

from nettobreite.config import get_paths, load_yaml


def _osm_vintage(region: str) -> str | None:
    """Datenstand der Region-PBF via osmium (None, wenn nicht ermittelbar)."""
    from nettobreite import osm

    spec = load_yaml("regions.yaml").get("regions", {}).get(region, {})
    pbf = spec.get("pbf")
    if not pbf:
        return None
    return osm.data_date(get_paths().raw / "osm" / pbf)


def _resolve_date(meta: dict[str, Any]) -> str | None:
    spec = meta.get("date")
    if isinstance(spec, dict) and "fixed" in spec:
        return str(spec["fixed"])
    if spec == "auto" and meta.get("region"):
        return _osm_vintage(meta["region"])
    return None


def generate() -> Path:
    sources = load_yaml("sources.yaml")["datasets"]
    paths = get_paths()
    today = date.today().isoformat()

    manifest: dict[str, dict[str, Any]] = {}
    for ds_id, meta in sources.items():
        entry: dict[str, Any] = {"label": meta.get("label")}
        if meta.get("attribution"):
            entry["attribution"] = meta["attribution"]
        if meta.get("live"):
            entry["live"] = True
        elif "external" in meta:
            entry["external"] = meta["external"]
        else:
            entry["file"] = meta["file"]
            entry["present"] = (paths.data / meta["file"]).exists()
            entry["vintage"] = _resolve_date(meta)
            entry["built"] = today
        manifest[ds_id] = entry

    out = paths.data / "manifest.json"
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(manifest, indent=2, ensure_ascii=False), encoding="utf-8")
    return out
