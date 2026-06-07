"""Smoke-Tests: die deklarativen Configs laden und sind plausibel; das Manifest
löst Datumsangaben korrekt auf. Kein IO/Build nötig."""

from __future__ import annotations

from nettobreite import manifest
from nettobreite.config import load_yaml


def test_regions_registry_valid():
    reg = load_yaml("regions.yaml")
    assert reg.get("default_region") in reg.get("regions", {})
    for name, spec in reg["regions"].items():
        assert "url" in spec and "pbf" in spec, f"{name}: url/pbf fehlt"


def test_sources_have_label_and_kind():
    for key, meta in load_yaml("sources.yaml")["datasets"].items():
        assert "label" in meta, f"{key}: label fehlt"
        has_kind = "file" in meta or meta.get("live") is True or "external" in meta
        assert has_kind, f"{key}: weder file noch live noch external"


def test_tiles_profile_layer_contract():
    prof = load_yaml("tiles.yaml")["profiles"]["nettobreite"]
    assert prof["layer"] == "nettobreite-lines"  # Frontend-Vertrag


def test_cqi_defaults_present():
    cqi = load_yaml("cqi.yaml")["defaults"]
    for key in ("parking_width_by_orientation", "parking_carriageway_fraction",
                "default_cycle_lane_width", "cycleway_onlane_types"):
        assert key in cqi, f"cqi.yaml: {key} fehlt"


def test_manifest_resolve_date_fixed_and_auto_without_region():
    assert manifest._resolve_date({"date": {"fixed": "2019-Q2"}}) == "2019-Q2"
    assert manifest._resolve_date({"date": "auto"}) is None  # ohne region -> None
    assert manifest._resolve_date({}) is None
