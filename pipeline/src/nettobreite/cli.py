"""CLI-Einstieg: `nettobreite <gruppe> <befehl>`.

Phase 0 = Gerüst: Struktur + Config-Wiring stehen, die eigentliche Logik folgt in
den späteren Phasen (Stubs sagen, was sie tun werden). Kein Verhaltenswechsel an
den Daten.
"""

from __future__ import annotations

import typer

from nettobreite import __version__
from nettobreite.config import default_region, get_paths, get_settings, load_yaml

app = typer.Typer(no_args_is_help=True, add_completion=False, help="nettobreite Pipeline")

osm_app = typer.Typer(no_args_is_help=True, help="OSM via Geofabrik + osmium")
width_app = typer.Typer(no_args_is_help=True, help="Nettobreite/CQI berechnen")
app.add_typer(osm_app, name="osm")
app.add_typer(width_app, name="width")

REGION_OPT = typer.Option(None, "--region", help="Region aus regions.yaml. Default: default_region")


def _region(region: str | None) -> str:
    return region or default_region()


def _todo(phase: str, what: str) -> None:
    typer.secho(f"[TODO {phase}] {what}", fg=typer.colors.YELLOW)
    raise typer.Exit(code=0)


@app.command()
def info() -> None:
    """Zeigt aufgelöste Pfade/Config (Smoke-Check, dass das Wiring steht)."""
    paths = get_paths()
    settings = get_settings()
    regions = load_yaml("regions.yaml")
    names = sorted(regions.get("regions", {}))
    typer.echo(f"nettobreite {__version__}")
    typer.echo(f"root:    {paths.root}")
    typer.echo(f"data:    {paths.data}")
    typer.echo(f"config:  {paths.config}")
    typer.echo(f"bucket:  {settings.b2_bucket_name}")
    typer.echo(f"default_region: {regions.get('default_region', '—')}")
    typer.echo(f"regions: {', '.join(names) or '—'}")


# --- osm (Phase 1) ---
@osm_app.command("fetch")
def osm_fetch(
    region: str = REGION_OPT,
    force: bool = typer.Option(False, "--force", help="Erneut laden, auch wenn vorhanden"),
) -> None:
    """Lädt die Region-PBF von Geofabrik nach data/raw/osm/."""
    from nettobreite import osm

    dest = osm.fetch(_region(region), force=force)
    typer.secho(f"PBF: {dest}", fg=typer.colors.GREEN)


@osm_app.command("build")
def osm_build(
    region: str = REGION_OPT,
    dry_run: bool = typer.Option(False, "--dry-run", help="Kommandos nur zeigen"),
) -> None:
    """osmium tags-filter -> pyogrio (direkt PBF->FGB) -> <region>_highways.fgb."""
    from nettobreite import osm

    out = osm.build(_region(region), dry_run=dry_run)
    typer.secho(f"highways: {out}", fg=typer.colors.GREEN)


# --- width (Phase 2) ---
@width_app.command("build")
def width_build(
    region: str = REGION_OPT,
    dry_run: bool = typer.Option(False, "--dry-run", help="Kommandos nur zeigen"),
) -> None:
    """CQI-/Nettobreite-Berechnung -> <region>_nettobreite.fgb (EPSG:4326)."""
    _todo("Phase 2", f"width build --region {_region(region)} (dry_run={dry_run})")


# --- tiles (Phase 3) ---
@app.command()
def tiles(
    region: str = REGION_OPT,
    dry_run: bool = typer.Option(False, "--dry-run", help="tippecanoe-Kommandos nur zeigen"),
) -> None:
    """tippecanoe -> data/nettobreite/<region>.pmtiles (Layer 'nettobreite-lines')."""
    _todo("Phase 3", f"tiles --region {_region(region)} (dry_run={dry_run})")


# --- top-level (Phase 4) ---
@app.command()
def manifest() -> None:
    """Generiert data/manifest.json (Local-first-Index + Datenstand)."""
    _todo("Phase 4", "manifest -> data/manifest.json")


@app.command()
def deploy(
    dry_run: bool = typer.Option(False, "--dry-run", help="b2-Kommandos nur zeigen"),
    bucket: str = typer.Option(None, "--bucket", help="Bucket überschreiben (sonst .env)"),
) -> None:
    """Lädt geänderte PMTiles + manifest.json via b2 sync ins Bucket (Secrets aus .env)."""
    _todo("Phase 4", f"deploy (dry_run={dry_run}, bucket={bucket})")


@app.command("build-all")
def build_all(region: str = REGION_OPT) -> None:
    """Convenience: fetch -> build -> width -> tiles -> manifest für eine Region."""
    _todo("Phase 4", f"build-all --region {_region(region)}")


if __name__ == "__main__":
    app()
