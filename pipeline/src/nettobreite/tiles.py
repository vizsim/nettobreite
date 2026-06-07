"""Tippecanoe-/tile-join-Wrapper. Profile stehen in config/tiles.yaml (keine
kopierten Argumentlisten). Bei dry_run oder fehlendem Binary werden die Kommandos
nur ausgegeben statt ausgeführt.

`build(region)` tilt data/raw/osm/<region>_nettobreite.fgb (aus width.build) nach
data/nettobreite/<region>.pmtiles — interner Layer `nettobreite-lines`.
"""

from __future__ import annotations

import subprocess
from pathlib import Path
from shutil import which
from typing import Any

from nettobreite.config import get_paths, load_yaml

_CFG = "tiles.yaml"


def _profiles() -> dict[str, Any]:
    return load_yaml(_CFG)["profiles"]


def _profile_args(profile: dict[str, Any], layer_override: str | None = None) -> list[str]:
    """Übersetzt ein Profil-Dict in tippecanoe-Flags (ohne -o/Input)."""
    args: list[str] = ["--force"]
    layer = layer_override or profile.get("layer")
    if layer:
        args += ["-l", layer]
    if "minzoom" in profile:
        args.append(f"--minimum-zoom={profile['minzoom']}")
    if "maxzoom" in profile:
        args.append(f"--maximum-zoom={profile['maxzoom']}")
    if "base_zoom" in profile:
        args.append(f"--base-zoom={profile['base_zoom']}")
    if "drop_rate" in profile:
        args.append(f"--drop-rate={profile['drop_rate']}")
    if profile.get("drop_densest_as_needed"):
        args.append("--drop-densest-as-needed")
    if profile.get("no_feature_limit"):
        args.append("--no-feature-limit")
    if profile.get("no_tile_size_limit"):
        args.append("--no-tile-size-limit")
    if "maximum_tile_bytes" in profile:
        args.append(f"--maximum-tile-bytes={profile['maximum_tile_bytes']}")
    return args


def _run(cmd: list[str], *, dry_run: bool) -> None:
    printable = " ".join(cmd)
    if dry_run or which(cmd[0]) is None:
        reason = "dry-run" if dry_run else f"'{cmd[0]}' nicht installiert"
        print(f"  [{reason}] {printable}")
        return
    print(f"  $ {printable}")
    subprocess.run(cmd, check=True)


def tippecanoe(
    profile_name: str,
    input_path: Path,
    output_path: Path,
    *,
    layer_override: str | None = None,
    dry_run: bool = False,
) -> Path:
    profile = _profiles()[profile_name]
    output_path.parent.mkdir(parents=True, exist_ok=True)
    cmd = [
        "tippecanoe", "-o", str(output_path),
        *_profile_args(profile, layer_override), str(input_path),
    ]
    _run(cmd, dry_run=dry_run)
    return output_path


def build(region: str, *, dry_run: bool = False) -> Path:
    """Tilt <region>_nettobreite.fgb -> data/nettobreite/<region>.pmtiles."""
    src = get_paths().raw / "osm" / f"{region}_nettobreite.fgb"
    out = get_paths().out("nettobreite") / f"{region}.pmtiles"
    if not dry_run and not src.exists():
        raise FileNotFoundError(
            f"Nettobreite-FGB fehlt: {src} — erst `nettobreite width build --region {region}`."
        )
    return tippecanoe("nettobreite", src, out, dry_run=dry_run)
