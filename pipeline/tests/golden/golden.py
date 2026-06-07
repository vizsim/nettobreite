"""Golden-Reference für die Nettobreite-Pipeline (Sicherheitsnetz).

Vermisst invariante Kennzahlen des `width.process_frame`-Outputs, damit der
Notebook->Python-Umbau objektiv abgesichert ist: Zeilenzahl, CRS, Spalten,
Histogramm der effektiven Breite über die Frontend-Kategorien und die
Missing-Flags. Die Frontend-Kategorien spiegeln die Legende in index.html.

Weil die Live-Geofabrik-PBF täglich driftet, läuft die Golden-Referenz NICHT auf
dem ganzen Berlin-Build, sondern auf einer eingefrorenen, deterministischen
Stichprobe (tests/golden/berlin_sample.parquet) → reproduzierbar pinnt sie die
*Logik*, nicht den Datenstand.

CLI (auf einem fertigen <region>_nettobreite.fgb):
  python tests/golden/golden.py capture <nettobreite.fgb> tests/golden/<name>.json
  python tests/golden/golden.py compare <nettobreite.fgb> tests/golden/<name>.json
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

import numpy as np
import pandas as pd

# Frontend-Kategorien der effektiven Breite (index.html-Legende). right=False.
_BINS = [-np.inf, 2, 3, 4, 4.5, 5, 5.5, 6, 7, 8, np.inf]
_LABELS = ["<2", "2-3", "3-4", "4-4.5", "4.5-5", "5-5.5", "5.5-6", "6-7", "7-8", ">8"]
_FLAGS = ["widths_missing", "parking_missing", "cycleway_missing"]


def measure(gdf: pd.DataFrame) -> dict:
    """Invariante Kennzahlen des Nettobreite-Frames."""
    we = pd.to_numeric(gdf["width_effective"], errors="coerce")
    cats = pd.cut(we.dropna(), bins=_BINS, labels=_LABELS, right=False)
    hist = {label: int(cats.value_counts().get(label, 0)) for label in _LABELS}
    epsg = gdf.crs.to_epsg() if getattr(gdf, "crs", None) else None
    return {
        "n_rows": int(len(gdf)),
        "crs": f"EPSG:{epsg}" if epsg else None,
        "columns": sorted(map(str, gdf.columns)),
        "width_effective_nan": int(we.isna().sum()),
        "width_effective_hist": hist,
        "flags": {f: int(gdf[f].sum()) for f in _FLAGS if f in gdf.columns},
    }


def diff(got: dict, want: dict) -> list[str]:
    """Liste der Abweichungen (leer == identisch)."""
    diffs: list[str] = []
    if got["n_rows"] != want["n_rows"]:
        diffs.append(f"n_rows: {want['n_rows']} -> {got['n_rows']}")
    if got["crs"] != want["crs"]:
        diffs.append(f"crs: {want['crs']} -> {got['crs']}")
    miss = sorted(set(want["columns"]) - set(got["columns"]))
    extra = sorted(set(got["columns"]) - set(want["columns"]))
    if miss:
        diffs.append(f"fehlende Spalten: {miss}")
    if extra:
        diffs.append(f"neue Spalten: {extra}")
    if got["width_effective_nan"] != want["width_effective_nan"]:
        diffs.append(
            f"width_effective_nan: {want['width_effective_nan']} -> {got['width_effective_nan']}"
        )
    for label in _LABELS:
        a, b = want["width_effective_hist"].get(label), got["width_effective_hist"].get(label)
        if a != b:
            diffs.append(f"hist[{label}]: {a} -> {b}")
    for flag, a in want.get("flags", {}).items():
        if got.get("flags", {}).get(flag) != a:
            diffs.append(f"flag[{flag}]: {a} -> {got.get('flags', {}).get(flag)}")
    return diffs


def _measure_file(fgb: str) -> dict:
    import geopandas as gpd

    return measure(gpd.read_file(fgb))


def main() -> int:
    p = argparse.ArgumentParser(description=__doc__)
    sub = p.add_subparsers(dest="cmd", required=True)
    c = sub.add_parser("capture")
    c.add_argument("fgb")
    c.add_argument("out")
    cmp = sub.add_parser("compare")
    cmp.add_argument("fgb")
    cmp.add_argument("golden")
    args = p.parse_args()

    if args.cmd == "capture":
        rec = _measure_file(args.fgb)
        Path(args.out).parent.mkdir(parents=True, exist_ok=True)
        Path(args.out).write_text(json.dumps(rec, indent=2, ensure_ascii=False), encoding="utf-8")
        print(f"golden geschrieben: {args.out}  (n_rows={rec['n_rows']})")
        return 0

    want = json.loads(Path(args.golden).read_text(encoding="utf-8"))
    diffs = diff(_measure_file(args.fgb), want)
    if diffs:
        print("ABWEICHUNG ggü. Golden:")
        for d in diffs:
            print(f"  - {d}")
        return 1
    print("OK — identisch zur Golden-Reference.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
