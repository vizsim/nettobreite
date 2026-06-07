"""Tests für den Tippecanoe-Wrapper — sichert vor allem den Frontend-Vertrag
(interner Layer-Name + Zoom) gegen versehentliche Änderungen ab."""

from __future__ import annotations

from nettobreite import tiles


def test_nettobreite_profile_args_match_frontend_contract():
    args = tiles._profile_args(tiles._profiles()["nettobreite"])
    # Layer-Name = source-layer in js/mapdata/addLayers.js
    assert args[args.index("-l") + 1] == "nettobreite-lines"
    assert "--minimum-zoom=9" in args
    assert "--maximum-zoom=11" in args
    assert "--no-feature-limit" in args


def test_build_dry_run_emits_command(capsys):
    tiles.build("berlin", dry_run=True)
    out = capsys.readouterr().out
    assert "nettobreite-lines" in out
    assert "berlin.pmtiles" in out
    assert "tippecanoe" in out
