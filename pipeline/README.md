# nettobreite — Pipeline

Skalierbare Python-Pipeline (uv) für die effektive Straßen**nettobreite** auf Basis
von OpenStreetMap und der [CQI-Methodik](https://www.osm-verkehrswende.org/cqi/).
Ersetzt die bisherigen Jupyter-Notebooks in `../preprocessing/`. Scope aktuell: **Berlin**.

## Setup

```bash
uv --directory pipeline sync
cp pipeline/.env.example pipeline/.env   # B2-Keys + Mapillary-Token eintragen
```

System-Binaries (nicht via pip): `tippecanoe` + `tile-join`, `osmium-tool`.
b2-CLI: `uv tool install b2`.

## CLI

```bash
uv --directory pipeline run nettobreite info                         # Pfade/Config-Smoke-Check
uv --directory pipeline run nettobreite osm   fetch --region berlin  # Geofabrik-PBF laden
uv --directory pipeline run nettobreite osm   build --region berlin  # -> <region>_highways.fgb
uv --directory pipeline run nettobreite width build --region berlin  # -> <region>_nettobreite.fgb
uv --directory pipeline run nettobreite tiles       --region berlin  # -> nettobreite/<region>.pmtiles
uv --directory pipeline run nettobreite manifest                     # -> data/manifest.json
uv --directory pipeline run nettobreite deploy --dry-run             # b2 sync
uv --directory pipeline run nettobreite build-all   --region berlin  # alles am Stück
```

`--region` defaultet auf `regions.yaml:default_region` (= berlin).

## Konfiguration (deklarativ, nicht im Code)

- `config/regions.yaml` — Skalierungsachse: Region → Geofabrik-PBF + `crs_metric`.
- `config/osm.yaml` — Highway-Extraktion (osmium-Filter + osmconf).
- `config/cqi.yaml` — CQI-/Nettobreite-Defaults (Parking-/Cycleway-Breiten etc.).
- `config/tiles.yaml` — tippecanoe-Profil(e).
- `config/sources.yaml` — Manifest-Metadata (Label/Attribution/Datenstand).

## Lint & Test

```bash
uvx ruff check pipeline
uv --directory pipeline run pytest
```
