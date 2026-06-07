"""Tests für die Nettobreite-Berechnung (width.py).

Zwei Ebenen:
1. Synthetische Unit-Tests pinnen den portierten Algorithmus exakt (jede Tag-
   Konstellation mit erwartetem width_effective) — das eigentliche Sicherheitsnetz
   für den Notebook->Python-Umbau, inkl. parking:restriction (neu).
2. Golden-Vergleich auf einer eingefrorenen Berlin-Stichprobe (Histogramm +
   Flags), damit Refactorings das Aggregat nicht still verändern.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

import pandas as pd
import pytest

from nettobreite import width

_GOLDEN = Path(__file__).parent / "golden"
sys.path.insert(0, str(_GOLDEN))
import golden  # noqa: E402

CFG = width.cqi_defaults()


def _df(**cols) -> pd.DataFrame:
    """Ein-Zeilen-Frame mit `:`-Spalten (fehlende Tags = nicht vorhanden)."""
    return pd.DataFrame({k: [v] for k, v in cols.items()})


def _we(**cols) -> float:
    """width_effective einer Zeile nach derive_effective_width."""
    return float(width.derive_effective_width(_df(**cols), CFG)["width_effective"].iloc[0])


# --------------------------- Basisbreite ----------------------------------- #


def test_width_base_priority_carriageway_over_width():
    out = width.derive_effective_width(_df(**{"width:carriageway": "8", "width": "10"}), CFG)
    assert float(out["width_base"].iloc[0]) == 8.0


def test_coerce_comma_and_unit():
    assert _we(**{"width": "3,5 m"}) == pytest.approx(3.5)


def test_no_tags_width_effective_nan():
    out = width.derive_effective_width(_df(highway="residential"), CFG)
    assert pd.isna(out["width_effective"].iloc[0])
    assert bool(out["widths_missing"].iloc[0])


# --------------------------- Parken ---------------------------------------- #


def test_parking_parallel_default_subtracted():
    # width 10, parking:left=lane (parallel-Default 2.2, position lane → frac 1.0)
    assert _we(**{"width": "10", "parking:left": "lane"}) == pytest.approx(7.8)


def test_parking_position_on_kerb_no_subtraction():
    assert _we(**{"width": "10", "parking:left": "lane",
                  "parking:left:position": "on_kerb"}) == pytest.approx(10.0)


def test_parking_explicit_width_and_orientation():
    # diagonal → 4.5; explizite Breite hat Vorrang
    assert _we(**{"width": "12", "parking:right": "lane",
                  "parking:right:width": "3"}) == pytest.approx(9.0)


def test_parking_both_applies_to_each_side():
    # parking:both=lane → links UND rechts je 2.2 abziehen
    assert _we(**{"width": "12", "parking:both": "lane"}) == pytest.approx(12 - 4.4)


def test_clamp_nonnegative():
    assert _we(**{"width": "2", "parking:both": "lane"}) == 0.0


# --------------------------- parking:restriction (neu) --------------------- #


def test_restriction_suppresses_subtraction():
    assert _we(**{"width": "10", "parking:left": "lane",
                  "parking:left:restriction": "no_stopping"}) == pytest.approx(10.0)


def test_restriction_loading_only_also_suppresses():
    assert _we(**{"width": "10", "parking:left": "lane",
                  "parking:left:restriction": "loading_only"}) == pytest.approx(10.0)


def test_restriction_none_does_not_suppress():
    # 'none' = keine Einschränkung → Abzug bleibt
    assert _we(**{"width": "10", "parking:left": "lane",
                  "parking:left:restriction": "none"}) == pytest.approx(7.8)


def test_restriction_both_suppresses_both_sides():
    assert _we(**{"width": "12", "parking:both": "lane",
                  "parking:both:restriction": "no_parking"}) == pytest.approx(12.0)


# --------------------------- Staggered ------------------------------------- #


def test_staggered_drops_smaller_side():
    # links 2, rechts 3, staggered → kleinere (links) auf 0 → nur 3 abziehen
    assert _we(**{
        "width": "12",
        "parking:left": "lane", "parking:left:width": "2", "parking:left:position": "lane",
        "parking:right": "lane", "parking:right:width": "3", "parking:right:position": "lane",
        "parking:both:staggered": "yes",
    }) == pytest.approx(9.0)


# --------------------------- Cycleway -------------------------------------- #


def test_cycleway_lane_subtracted():
    assert _we(**{"width": "10", "cycleway:left": "lane",
                  "cycleway:left:width": "1.5"}) == pytest.approx(8.5)


def test_cycleway_track_not_subtracted():
    # track = baulich getrennt → kein Fahrbahnabzug
    assert _we(**{"width": "10", "cycleway:left": "track"}) == pytest.approx(10.0)


def test_cycleway_default_width_when_missing():
    assert _we(**{"width": "10", "cycleway:both": "lane"}) == pytest.approx(10 - 2 * 1.4)


def test_bicycle_road_no_cycleway_subtraction_and_not_missing():
    out = width.derive_effective_width(
        _df(**{"width": "10", "bicycle_road": "yes",
               "parking:left": "lane", "parking:left:restriction": "no_stopping"}),
        CFG,
    )
    assert not bool(out["cycleway_missing"].iloc[0])
    assert float(out["width_effective"].iloc[0]) == pytest.approx(10.0)


# --------------------------- width:effective override ---------------------- #


def test_width_effective_tag_overrides():
    assert _we(**{"width": "10", "parking:both": "lane",
                  "width:effective": "3.5"}) == pytest.approx(3.5)


# --------------------------- process_frame NaN-Masking --------------------- #


def test_process_frame_nans_when_flag_set():
    # width gesetzt, aber parking & cycleway fehlen → parking_missing/cycleway_missing
    # → process_frame setzt width_effective auf NaN
    out = width.process_frame(_df(highway="residential", width="10"), CFG)
    assert pd.isna(out["width_effective"].iloc[0])


def test_process_frame_keeps_value_when_complete():
    out = width.process_frame(
        _df(**{"highway": "residential", "width": "10",
               "parking:left": "no", "cycleway:left": "no"}),
        CFG,
    )
    assert float(out["width_effective"].iloc[0]) == pytest.approx(10.0)


# --------------------------- Golden ---------------------------------------- #


def test_golden_berlin_sample():
    sample = pd.read_parquet(_GOLDEN / "berlin_sample.parquet")
    processed = width.process_frame(sample, CFG)
    got = golden.measure(processed)
    want = json.loads((_GOLDEN / "berlin.json").read_text(encoding="utf-8"))
    diffs = golden.diff(got, want)
    assert not diffs, "Golden-Abweichung:\n" + "\n".join(diffs)
