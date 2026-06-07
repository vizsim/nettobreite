"""Effektive Straßennettobreite (CQI) aus OSM-Tags — Herzstück der Pipeline.

Portiert aus preprocessing/1_prepare_width_calc_berlin.ipynb (Schwellen/Defaults
exakt erhalten, Parameter ausgelagert nach config/cqi.yaml). Statt der Notebook-
Global-Mutation wird die Config explizit durchgereicht; das Ergebnis ist bit-
identisch (durch tests/test_width.py + Golden-Reference abgesichert).

Ableitung: aus `width`/`width:carriageway`/`est_width` die Basisbreite, davon
on-carriageway-Parken und on-carriageway-Radspuren abziehen → `width_effective`.
`width:effective` (falls getaggt) überschreibt das Ergebnis direkt. Drei
Missing-Flags markieren fehlende Angaben (Frontend färbt sie schwarz).

NEU ggü. Notebook: `parking:restriction` (jeder gesetzte Wert ⇒ kein Parkabzug
für die Seite, config/cqi.yaml: parking_restriction_suppresses_any).

IO/Logik getrennt: `process_frame` ist rein (gut testbar), `build` macht das IO.
Input:  data/raw/osm/<region>_highways.fgb  (aus osm.build, GDAL-`_`-Spaltennamen)
Output: data/raw/osm/<region>_nettobreite.fgb  (EPSG:4326)
"""

from __future__ import annotations

from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd

from nettobreite.config import get_paths, load_yaml

_CQI_CFG = "cqi.yaml"

# Spalten, die NICHT von `_`->`:` rückbenannt werden (GDAL ersetzt `:` durch `_`;
# diese tragen aber von Haus aus einen Unterstrich im OSM-Key).
_RENAME_EXCLUDE = {"est_width", "bicycle_road"}

# Ergebnis-/Output-Spalten (aus dem Notebook). Restriction-Spalten sind dabei.
_WANTED_COLS = [
    "osm:id", "geometry",
    "width:carriageway", "width", "est_width", "width:effective",
    "lanes", "lanes:forward", "lanes:backward",
    "highway",
    "parking:left", "parking:right", "parking:both",
    "parking:both:orientation", "parking:left:orientation", "parking:right:orientation",
    "parking:both:position", "parking:left:position", "parking:right:position",
    "parking:both:width", "parking:left:width", "parking:right:width",
    "parking:both:restriction", "parking:left:restriction", "parking:right:restriction",
    "parking:both:staggered",
    "cycleway", "cycleway:left", "cycleway:right", "cycleway:both",
    "cycleway:width", "cycleway:left:width", "cycleway:right:width",
    "oneway",
    "bicycle_road",
    "width_base", "parking_left_onlane_m", "parking_right_onlane_m",
    "cycleway_left_onlane_m", "cycleway_right_onlane_m",
    "width_effective",
    "cycleway_missing", "parking_missing", "widths_missing",
]


def cqi_defaults() -> dict[str, Any]:
    return load_yaml(_CQI_CFG)["defaults"]


# ----------------------------- Helpers ------------------------------------- #


def _coerce_float(series: pd.Series | None, index: pd.Index | None = None) -> pd.Series:
    """Strings wie '3.5', '3,5', '3.5 m' -> float Meter."""
    if series is None:
        return pd.Series(index=index, dtype=float) if index is not None else pd.Series(dtype=float)
    s = series.astype(str).str.strip()
    s = (
        s.str.replace(",", ".", regex=False)
        .str.replace(" metres", "", regex=False)
        .str.replace(" meter", "", regex=False)
        .str.replace(" meters", "", regex=False)
        .str.replace(" m", "", regex=False)
    )
    return pd.to_numeric(s, errors="coerce")


def _first_nonnull(*cols: pd.Series) -> pd.Series:
    if not cols:
        raise ValueError("No columns provided")
    result = cols[0].copy()
    for s in cols[1:]:
        result = result.where(result.notna(), s)
    return result


def _restriction_active(series: pd.Series | None, index: pd.Index, ignore: set[str]) -> pd.Series:
    """True wo parking:*:restriction eine echte Einschränkung trägt.

    Gesetzt (notna, nicht leer) UND nicht in `ignore` (z.B. 'none'/'no' = keine
    Einschränkung). Vergleich case-insensitiv.
    """
    if series is None:
        return pd.Series(False, index=index)
    val = series.astype(str).str.strip()
    return series.notna() & val.ne("") & ~val.str.lower().isin(ignore)


def _parking_width_side(df: pd.DataFrame, side: str, cfg: dict[str, Any]) -> pd.Series:
    """Abzuziehende Parkbreite einer Seite (nur der Fahrbahn-Anteil).

    Breitenquelle: parking:<side>:width → sonst orientation-Default → parallel-Default.
    Position-Default = 'lane' wenn unbekannt. highway=path ohne parking-Tags ⇒ 0.
    NEU: jeder gesetzte parking:*:restriction-Wert ⇒ 0 (kein Auto auf der Fahrbahn).
    """
    assert side in ("left", "right")
    orient_map = cfg["parking_width_by_orientation"]
    default_parallel = cfg["default_parallel_parking_width"]
    frac_map = cfg["parking_carriageway_fraction"]
    default_pos = cfg["default_parking_position"]

    p_base = df.get(f"parking:{side}")
    p_both = df.get("parking:both")
    if p_base is None:
        p_base = pd.Series(index=df.index, dtype=object)
    if p_both is None:
        p_both = pd.Series(index=df.index, dtype=object)
    base_val = p_base.where(p_base.notna(), p_both)

    orient = df.get(f"parking:{side}:orientation")
    if orient is None:
        orient = pd.Series(index=df.index, dtype=object)
    pos = df.get(f"parking:{side}:position")
    if pos is None:
        pos = pd.Series(index=df.index, dtype=object)

    width_tag = _coerce_float(df.get(f"parking:{side}:width"), index=df.index)

    highway = df.get("highway", pd.Series(index=df.index, dtype=object))
    has_parking_tags = base_val.notna() | width_tag.notna() | orient.notna() | pos.notna()
    is_path = highway == "path"
    no_default_for_path = is_path & ~has_parking_tags

    orient_width = orient.map(orient_map)
    orient_width = orient_width.fillna(default_parallel)
    raw_width = width_tag.where(width_tag.notna(), orient_width)
    raw_width = raw_width.where(~no_default_for_path, 0.0)

    frac_from_pos = pos.map(frac_map)
    if frac_from_pos is None:
        frac_from_pos = pd.Series(index=df.index, dtype=float)

    inferred_frac = pd.Series(0.0, index=df.index)
    if base_val.notna().any():
        inferred_frac = pd.to_numeric(base_val.replace(frac_map), errors="coerce")

    frac = frac_from_pos.where(frac_from_pos.notna(), inferred_frac)
    default_frac = pd.Series(frac_map.get(default_pos, 1.0), index=df.index)
    default_frac = default_frac.where(~no_default_for_path, 0.0)
    frac = frac.where(frac.notna(), default_frac)

    result = (raw_width * frac).fillna(0.0)

    if cfg.get("parking_restriction_suppresses_any"):
        ignore = {v.lower() for v in cfg.get("parking_restriction_ignore_values", [])}
        restricted = _restriction_active(
            df.get(f"parking:{side}:restriction"), df.index, ignore
        ) | _restriction_active(df.get("parking:both:restriction"), df.index, ignore)
        result = result.where(~restricted, 0.0)

    return result


def _cycle_lane_width_side(df: pd.DataFrame, side: str, cfg: dict[str, Any]) -> pd.Series:
    """Abzuziehende Rad-LANE-Breite einer Seite — nur on-carriageway-Typen."""
    assert side in ("left", "right")
    default_cycle = cfg["default_cycle_lane_width"]
    onlane_types = cfg["cycleway_onlane_types"]

    side_val = df.get(f"cycleway:{side}")
    both_val = df.get("cycleway:both")
    generic = df.get("cycleway")

    eff = side_val.copy() if side_val is not None else pd.Series(index=df.index, dtype=object)
    if both_val is not None:
        eff = eff.where(eff.notna(), both_val)
    if generic is not None:
        eff = eff.where(eff.notna(), generic)
    eff = eff.fillna("")

    width_side = _coerce_float(df.get(f"cycleway:{side}:width"), index=df.index)
    width_both = _coerce_float(df.get("cycleway:width"), index=df.index)
    width_raw = width_side.where(width_side.notna(), width_both)
    width_raw = width_raw.fillna(default_cycle)

    onlane_mask = eff.isin(onlane_types)
    return width_raw.where(onlane_mask, 0.0)


# --------------------------- Public logic ---------------------------------- #


def derive_effective_width(gdf: pd.DataFrame, cfg: dict[str, Any] | None = None) -> pd.DataFrame:
    """Fügt die Nettobreite-Spalten hinzu (erwartet `:`-Spaltennamen).

    Ergebnis-Spalten: width_base, parking_{left,right}_onlane_m,
    cycleway_{left,right}_onlane_m, width_effective sowie die Flags
    widths_missing / parking_missing / cycleway_missing.
    """
    cfg = cfg or cqi_defaults()
    df = gdf.copy()
    clamp = cfg.get("clamp_nonnegative", True)

    # 1) Basisbreite OHNE Lanes-Fallback
    width_carriageway = _coerce_float(df.get("width:carriageway"), index=df.index)
    width_total = _coerce_float(df.get("width"), index=df.index)
    width_est = _coerce_float(df.get("est_width"), index=df.index)
    df["width_base"] = _first_nonnull(width_carriageway, width_total, width_est)
    df["widths_missing"] = width_carriageway.isna() & width_total.isna() & width_est.isna()

    # 2) Parking-Abzug
    df["parking_left_onlane_m"] = _parking_width_side(df, "left", cfg)
    df["parking_right_onlane_m"] = _parking_width_side(df, "right", cfg)

    def _has_parking_tags_side(side: str) -> pd.Series:
        w = df.get(f"parking:{side}:width")
        w_set = (
            pd.Series(False, index=df.index)
            if w is None
            else _coerce_float(w, df.index).notna()
        )
        return (
            _series_notna(df, f"parking:{side}")
            | _series_notna(df, f"parking:{side}:orientation")
            | _series_notna(df, f"parking:{side}:position")
            | w_set
        )

    left_has = _has_parking_tags_side("left")
    right_has = _has_parking_tags_side("right")
    both_has = _series_notna(df, "parking:both")
    df["parking_missing"] = ~(left_has | right_has | both_has)

    # 2b) Bicycle-Road-Heuristik: bicycle_road=yes ⇒ fehlende cycleway* als "no"
    br = df.get("bicycle_road")
    bicycle_road_yes = (
        pd.Series(False, index=df.index)
        if br is None
        else br.astype(str).str.strip().str.lower().eq("yes")
    )
    for col in ["cycleway", "cycleway:left", "cycleway:right", "cycleway:both"]:
        s = df.get(col)
        if s is None:
            df[col] = pd.Series(index=df.index, dtype=object)
            s = df[col]
        df[col] = s.where(~(bicycle_road_yes & s.isna()), "no")

    # 2c) Staggered-Parking: nur die größere Seite anrechnen (Gleichstand: rechts bleibt)
    stag = df.get("parking:both:staggered")
    staggered_yes = (
        pd.Series(False, index=df.index)
        if stag is None
        else stag.astype(str).str.strip().str.lower().eq("yes")
    )
    left_vals = df["parking_left_onlane_m"].fillna(0.0)
    right_vals = df["parking_right_onlane_m"].fillna(0.0)
    df.loc[staggered_yes & (left_vals <= right_vals), "parking_left_onlane_m"] = 0.0
    df.loc[staggered_yes & (right_vals < left_vals), "parking_right_onlane_m"] = 0.0

    # 3) Cycleway-Abzug
    df["cycleway_left_onlane_m"] = _cycle_lane_width_side(df, "left", cfg)
    df["cycleway_right_onlane_m"] = _cycle_lane_width_side(df, "right", cfg)
    df["cycleway_missing"] = ~(
        _series_notna(df, "cycleway")
        | _series_notna(df, "cycleway:left")
        | _series_notna(df, "cycleway:right")
        | _series_notna(df, "cycleway:both")
        | _series_notna(df, "cycleway:width")
        | _series_notna(df, "cycleway:left:width")
        | _series_notna(df, "cycleway:right:width")
    ) & ~bicycle_road_yes

    # 4) Effektive Breite & Clipping
    subtract_sum = (
        df[
            [
                "parking_left_onlane_m",
                "parking_right_onlane_m",
                "cycleway_left_onlane_m",
                "cycleway_right_onlane_m",
            ]
        ]
        .sum(axis=1, min_count=1)
        .fillna(0.0)
    )
    df["width_effective"] = df["width_base"] - subtract_sum
    if clamp:
        df["width_effective"] = df["width_effective"].clip(lower=0.0)

    # 4b) Override durch getaggte width:effective
    width_effective_tag = _coerce_float(df.get("width:effective"), index=df.index)
    if "width:effective" in df.columns:
        df["width_effective"] = width_effective_tag.where(
            width_effective_tag.notna(), df["width_effective"]
        )
    if clamp:
        df["width_effective"] = df["width_effective"].clip(lower=0.0)

    return df


def _series_notna(df: pd.DataFrame, name: str) -> pd.Series:
    s = df.get(name)
    return pd.Series(False, index=df.index) if s is None else s.notna()


def restore_osm_colnames(gdf: pd.DataFrame) -> pd.DataFrame:
    """GDAL-`_`-Spaltennamen wieder auf OSM-`:`-Keys (außer est_width/bicycle_road)."""
    gdf = gdf.copy()
    gdf.columns = [c if c in _RENAME_EXCLUDE else c.replace("_", ":") for c in gdf.columns]
    return gdf


def process_frame(gdf_raw: pd.DataFrame, cfg: dict[str, Any] | None = None) -> pd.DataFrame:
    """Reine Logik (kein IO): Rückbenennung → Ableitung → Output-Spalten + Missing→NaN.

    Erwartet das GDAL-rohe Highways-Frame (Spalten mit `_`). Liefert das fertige
    Nettobreite-Frame mit `width_effective` = NaN, wo eine Missing-Flag greift.
    """
    cfg = cfg or cqi_defaults()
    df = restore_osm_colnames(gdf_raw)
    df = derive_effective_width(df, cfg)

    available = [c for c in _WANTED_COLS if c in df.columns]
    out = df[available].copy()

    mask = out["cycleway_missing"] | out["parking_missing"] | out["widths_missing"]
    out.loc[mask, "width_effective"] = np.nan
    return out


def build(region: str, *, dry_run: bool = False) -> Path:
    """Liest <region>_highways.fgb, rechnet die Nettobreite, schreibt
    <region>_nettobreite.fgb (EPSG:4326)."""
    import geopandas as gpd

    raw = get_paths().raw / "osm"
    src = raw / f"{region}_highways.fgb"
    out = raw / f"{region}_nettobreite.fgb"
    if dry_run:
        print(f"  [dry-run] width: {src} -> {out}")
        return out
    if not src.exists():
        raise FileNotFoundError(f"Highways-FGB fehlt: {src} — erst `nettobreite osm build`.")

    gdf = gpd.read_file(src)
    result = process_frame(gdf, cqi_defaults())
    result = gpd.GeoDataFrame(result, geometry="geometry", crs=gdf.crs)
    out.parent.mkdir(parents=True, exist_ok=True)
    result.to_file(out, driver="FlatGeobuf")
    return out
