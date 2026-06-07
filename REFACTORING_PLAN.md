# Refactoring-Plan: nettobreite — Notebooks → skalierbare Python-Pipeline (+ Frontend-Feinschliff)

> **Für den ausführenden Agenten (Claude in der IDE):** Dieses Dokument ist der
> Arbeitsplan. Arbeite es **phasenweise** ab (Phase 0 → 6), jede Phase = ein kleiner,
> fokussierter Commit auf einem Branch `refactor/python-pipeline`. Nach jeder Phase die
> jeweiligen **Akzeptanzkriterien** prüfen. Halte dich strikt an die **Harten Regeln**.
>
> **Blaupause:** Das Schwester-Projekt `vizsim/unfallkarte`, **Branch `unfallkarte-2026`**,
> hat genau diesen Umbau (Notebooks → uv-Pipeline + keyless Frontend) bereits vollzogen.
> Hol dir den Branch als Referenz, bevor du loslegst:
> ```bash
> git clone --depth 1 --branch unfallkarte-2026 \
>   https://github.com/vizsim/unfallkarte.git /tmp/uf-blueprint
> ```
> Übernimm Muster aus diesen Dateien (Pfade relativ zur Blaupause):
> `CLAUDE.md`, `REFACTORING_PLAN.md`, `pipeline/pyproject.toml`,
> `pipeline/src/unfallkarte/{config,cli,osm,tiles,manifest,deploy}.py`,
> `pipeline/config/{osm,tiles,sources}.yaml`,
> `js/map/basemapTerrain.js`, `js/mapdata/resolveSources.js`,
> `js/utils/applyDataVintages.js`, sowie `index.html`/`style.css` (Panel-Markup + CSS).

---

## 0. Ziel & Kontext

**Ist-Zustand (nettobreite, main):** Zwei Jupyter-Notebooks bauen die Daten:
- `preprocessing/0_prepare_network_pbf_get_highways.ipynb` — extrahiert Highways aus einer OSM-PBF.
- `preprocessing/1_prepare_width_calc_berlin.ipynb` — berechnet die **effektive Nettobreite** (CQI-Methodik). **Berlin ist im Namen/Code festverdrahtet.**
- `preprocessing/processed_osm_files/osmconf_highways-widths.ini` — GDAL-OSM-Attribut-Whitelist (width/parking/cycleway-Tags). **Wird wiederverwendet.**

**Ziele dieses Refactors:**
1. **Skalierbarkeit:** jedes Bundesland bzw. ganz Deutschland prozessierbar — die Region ist die einzige Achse. **Erst mal nur Berlin** lauffähig machen.
2. **Weg von Jupyter:** wartbarer, getippter, getesteter **Python-Code mit CLI** (uv-Paket `nettobreite`).
3. **Frontend aufhübschen:** insbesondere das **Basemap-Panel unten links** (1:1 aus der Blaupause).
4. **Datenstand in der UI:** dynamisch aus einem generierten `manifest.json`, statt hartkodiertem „Datenstand: 9.11.2025".

**Schlüssel-Idee:** In der Blaupause ist die deklarative `accidents.yaml`-**Jahres**-Registry das Mittel gegen Hardcoding. Hier ist das Pendant eine **`regions.yaml`-Region-Registry**. Dein `_berlin`-Hardcoding wird damit zu *einem YAML-Block*; weitere Bundesländer/Deutschland = weitere Blöcke, **kein Code-Edit**.

---

## 1. Harte Regeln (nicht brechen)

- **Frontend-Vertrag:** PMTiles-**Dateinamen** und der **interne Layer-Name** (`nettobreite`, ggf. `width`) sind ein Vertrag mit `js/mapdata/addSources.js` + `addLayers.js`. Änderst du einen Namen, ziehst du das Frontend **im selben Commit** mit.
- **CRS:** Die Breitenberechnung ist überwiegend *attributbasiert* (Tag-Parsing). Falls metrische Geometrie-Operationen nötig sind (Puffer, Längen), in der **region-lokalen UTM** rechnen (`crs_metric` aus `regions.yaml`, Berlin = **EPSG:25833**), Output **immer EPSG:4326**. Nie vermischen.
- **tippecanoe legt Integer/Float-Attribute als String im PMTiles ab** → im Frontend immer `["to-number", …]` bzw. `Number(...)`. Die bestehenden Farb-Expressions müssen weiter greifen (siehe §4, Spalten-Vertrag).
- **Keyless:** kein MapTiler, kein API-Key im Code. Basemap = OpenFreeMap (Positron + OSM-Carto/Esri-Raster), Terrain/Hillshade = Mapterhorn (gehosteter Endpoint).
- **Secrets nur in `.env`** (gitignored). Niemals Tokens/Keys committen. Das aktuell im Repo liegende Mapillary-Token in `js/config/config.public.js` **rotieren** und nach `.env` verschieben.
- **Packaging: uv.** Nie `pip install`. Deps via `uv --directory pipeline add`, Ausführung via `uv --directory pipeline run`. Lint `uvx ruff check`, Tests `uv run pytest`.
- **Keine Notebooks in der Pipeline.** Logik liegt in `src/`, Parameter in `config/*.yaml`.
- **System-Binaries (nicht via pip):** `tippecanoe` + `tile-join`, `osmium-tool`. b2-CLI via `uv tool install b2`. (`ogr2ogr`/gdal-bin **nicht** nötig — OSM-PBF wird direkt mit `pyogrio` gelesen, das GDAL mitbringt.)
- **`data/` ist gitignored** (raw + abgeleitete Artefakte). Bereits getrackte Großdateien per `git rm --cached` aus dem Tracking nehmen (Datei bleibt lokal).

---

## 2. Zielarchitektur (Repo-Layout)

`pipeline/` lebt im Repo-Root, das statische Frontend bleibt im Root. Getrimmt gegenüber der Blaupause: **kein `accidents`, keine `scenarios`** — nettobreite hat eine OSM-Quelle und einen abgeleiteten Layer.

```
nettobreite/
├── index.html, main.js, style.css, style.json   # Frontend (Root, bleibt)
├── js/ …                                         # Frontend-Module (bleibt, wird erweitert)
├── data/  ->  pipeline/data                       # gitignored Symlink (Frontend Local-first)
└── pipeline/
    ├── pyproject.toml          # uv-Paket "nettobreite" (Deps aus Blaupause übernehmen)
    ├── uv.lock
    ├── .env.example            # B2-Keys (+ optional Mapillary-Token)
    ├── .gitignore              # data/, .env
    ├── README.md
    ├── config/
    │   ├── regions.yaml        # ⭐ region -> Geofabrik-PBF + crs_metric (DIE Skalierungsachse)
    │   ├── osm.yaml            # Highway-Extraktion (osmium-filter + osmconf + osm_layers)
    │   ├── cqi.yaml            # CQI-/Nettobreite-Defaults (Parking-/Cycleway-Breiten etc.)
    │   ├── tiles.yaml          # tippecanoe-Profil(e)
    │   ├── sources.yaml        # Manifest-Metadata (Label/Attribution/Datenstand)
    │   └── osmconf/
    │       └── osmconf_highways-widths.ini   # aus preprocessing/processed_osm_files/ verschoben
    ├── src/nettobreite/
    │   ├── __init__.py         # __version__
    │   ├── config.py           # Paths + Settings(.env) + load_yaml   — ~1:1 aus Blaupause
    │   ├── cli.py              # typer-Einstieg                       — Struktur aus Blaupause
    │   ├── osm.py              # Geofabrik(region) + osmium + pyogrio -> FGB  ← Notebook 0
    │   ├── width.py            # ⭐ CQI/Nettobreite-Berechnung                ← Notebook 1
    │   ├── geo.py              # optionale Spatial-Helper (to_metric/to_wgs)
    │   ├── tiles.py            # tippecanoe-/tile-join-Wrapper        — ~1:1 aus Blaupause
    │   ├── manifest.py         # data/manifest.json (Datenstand)      — ~1:1 aus Blaupause
    │   └── deploy.py           # b2 sync                              — ~1:1 aus Blaupause
    └── tests/
        ├── golden/             # Berlin: Feature-Count + Breitenverteilung stabil
        └── test_*.py
```

**Daten-/Output-Pfade (= Subfolder im B2-Bucket, `b2 sync` spiegelt 1:1):**
- Roh-PBF: `data/raw/osm/<region>-latest.osm.pbf`
- Highway-Zwischenprodukt: `data/raw/osm/<region>_highways.fgb`
- Nettobreite-Zwischenprodukt: `data/raw/osm/<region>_nettobreite.fgb`
- Finale Tiles: `data/nettobreite/<region>.pmtiles`
- Manifest: `data/manifest.json`

> **Region = Identität (Teil des Dateinamens), nicht Version.** Der Datenstand (PBF-Datum) lebt im Manifest, nicht im Namen.

---

## 3. Config-Schemas (deklarativ — füll diese, nicht den Code)

### 3.1 `config/regions.yaml` — die Skalierungs-Registry ⭐
```yaml
# Neue Region/Bundesland/Deutschland = EIN Block, kein Code-Edit.
# (Pendant zu accidents.yaml/years aus unfallkarte-2026.)
default_region: berlin
regions:
  berlin:
    url: "https://download.geofabrik.de/europe/germany/berlin-latest.osm.pbf"  # VERIFIZIEREN
    pbf: "berlin-latest.osm.pbf"
    crs_metric: "EPSG:25833"        # UTM 33N (Berlin/Brandenburg)
    center: [13.404, 52.520]        # optional, fürs Frontend
    # bbox/zoom optional
  # brandenburg:
  #   url: "https://download.geofabrik.de/europe/germany/brandenburg-latest.osm.pbf"
  #   pbf: "brandenburg-latest.osm.pbf"
  #   crs_metric: "EPSG:25833"
  # germany:
  #   url: "https://download.geofabrik.de/europe/germany-latest.osm.pbf"
  #   pbf: "germany-latest.osm.pbf"
  #   crs_metric: "EPSG:25832"       # UTM 32N (DE-weiter Default)
```

### 3.2 `config/osm.yaml` — Highway-Extraktion
```yaml
# osmium tags-filter (streaming) -> Kategorie-PBF -> pyogrio liest "lines" DIREKT
# (OSM_CONFIG_FILE = osmconf) -> FlatGeobuf. Kein ogr2ogr/GPKG/GeoJSON.
highways:
  # Filter an Notebook 0 angleichen! Für Nettobreite (Überholbreite) i.d.R. ohne
  # motorway/trunk; relevant sind innerörtliche Straßen.
  osmium_filter:
    - "w/highway=primary,secondary,tertiary,unclassified,residential,living_street,road,primary_link,secondary_link,tertiary_link"
  osmconf: "osmconf_highways-widths.ini"   # bereits vorhanden (exponiert width/parking/cycleway/lanes/…)
  osm_layers: ["lines"]
  # Output je Region: data/raw/osm/<region>_highways.fgb  (Input für width.py)
```

### 3.3 `config/cqi.yaml` — Breiten-Parameter (gegen Hardcoding)
```yaml
# Aus Notebook 1 extrahieren — adressiert direkt die README-Limitationen
# "Default-Werte / regionale Anpassung". NICHT im Code hardcoden.
defaults:
  parking_width_m: ___        # angenommene Breite parkender Kfz (je Seite)
  cycleway_width_m: ___       # angenommene Radweg-/Schutzstreifenbreite
  # … weitere CQI-Annahmen exakt aus dem Notebook übernehmen
# Optional je Region überschreibbar (regional anpassbar):
# overrides:
#   berlin: { parking_width_m: ___ }
```

### 3.4 `config/tiles.yaml` — Tippecanoe-Profil
```yaml
profiles:
  nettobreite:
    layer: nettobreite          # interner Layer-Name = Frontend-Vertrag (NICHT ändern)
    minzoom: 10                 # an aktuelle style.json/addLayers angleichen
    maxzoom: 14
    drop_densest_as_needed: true
    no_feature_limit: true
    no_tile_size_limit: true
```

### 3.5 `config/sources.yaml` — Manifest-Metadata
```yaml
datasets:
  nettobreite_berlin:
    file: "nettobreite/berlin.pmtiles"
    label: "Nettobreite (Berlin)"
    attribution: "© OpenStreetMap-Mitwirkende (ODbL) · CQI-Methodik (osm-verkehrswende.org/cqi)"
    date: auto                  # = osmium fileinfo der Region-PBF
  mapillary:
    live: true                  # externe Coverage-Tiles, kein Build-Artefakt
    label: "Mapillary-Straßenfotos"
    attribution: "Mapillary (CC BY-SA 4.0)"
```

---

## 4. Modul-Verträge

Alle „~1:1 aus Blaupause": Datei aus `/tmp/uf-blueprint/pipeline/src/unfallkarte/` kopieren, Paketname `unfallkarte` → `nettobreite` ersetzen, ungenutzte (accidents/scenario-)Teile entfernen.

- **`config.py`** — ~1:1. `repo_root()`, `Paths` (mit `out(subdir)`), `Settings` (pydantic-settings, `.env`), `load_yaml`. `b2_bucket_name`-Default auf z. B. `nettobreite-data` setzen.
- **`cli.py`** — Struktur aus Blaupause (typer, `no_args_is_help`). Befehle: siehe §5. Logik lazy in den Befehlen importieren.
- **`osm.py`** — ~1:1 aus Blaupause, **mit Region-Parameter**:
  - `fetch(region, *, force)` — lädt `regions[region].url` nach `data/raw/osm/<pbf>`.
  - `data_date(pbf)` — `osmium fileinfo -e -g data.timestamp.last` → `YYYY-MM-DD` (für Manifest).
  - `tags_filter(...)`, `pbf_layers_to_fgb(...)` (pyogrio, `OSM_CONFIG_FILE`, **`OGR_INTERLEAVED_READING` NICHT auf YES zwingen**), `build(region, *, dry_run)` → `<region>_highways.fgb`.
- **`width.py`** — ⭐ **das Herzstück, NEU. Portiere die Logik aus `preprocessing/1_prepare_width_calc_berlin.ipynb`** (lies das Notebook vollständig, bevor du schreibst):
  - Signatur: `build(region, *, dry_run=False) -> Path`.
  - Input: `data/raw/osm/<region>_highways.fgb` (aus `osm.build`).
  - Schritte (aus Notebook übernehmen, **Schwellen/Defaults exakt erhalten**): width-Tags parsen (Komma→Punkt, Einheiten/Ranges), `width:effective` direkt nutzen falls vorhanden; sonst Nettobreite aus `width`/`width:carriageway` **minus** Parken (`parking:*`) und Radinfrastruktur (`cycleway:*`) nach CQI berechnen; Defaults aus `cqi.yaml`.
  - Output: `data/raw/osm/<region>_nettobreite.fgb`, **EPSG:4326**.
  - **Spalten-Vertrag** (damit die Frontend-Farb-Expressions weiter greifen — Kategorien siehe `index.html`-Legende):
    - effektive Breite, numerisch — Frontend-Kategorien: `<2` (grau, „nicht plausibel"), 2–3, 3–4, 4–4.5, 4.5–5, 5–5.5, 5.5–6, 6–7, 7–8, `>8`.
    - Roh-Breite (`width`/`width:carriageway`), numerisch — Kategorien: `<5`, 5–7, 7–9, 9–11, `>11`.
    - Flags „fehlende Angaben" (schwarz): `cycleway` fehlt / `parking` fehlt / `width` fehlt.
  - **Bekannte Limitation aus README adressieren:** `parking:restriction` jetzt mitberücksichtigen (war bisher offen) — als TODO markieren, falls Notebook es nicht hat.
- **`geo.py`** — nur falls metrische Ops nötig: `to_metric(gdf, crs)` / `to_wgs(gdf)`.
- **`tiles.py`** — ~1:1. `tippecanoe(profile, input, output, layer_override, dry_run)` aus `tiles.yaml`. (`build_accident_tiles`/`build_dual_layer` entfallen.)
- **`manifest.py`** — ~1:1. `generate()` liest `sources.yaml`, löst `date: auto` für OSM-abgeleitete Einträge via `osm.data_date(<region>-PBF)` auf, setzt `present` (Local-first), schreibt `data/manifest.json`.
- **`deploy.py`** — ~1:1. `b2 sync` nur `*.pmtiles` + `manifest.json`, Keys aus `.env`, mit `--dry-run`. (Retry/Backoff optional ergänzen.)

---

## 5. CLI-Oberfläche

```
nettobreite info                                  # Pfade/Config-Smoke-Check (zeigt regions)
nettobreite osm   fetch  --region berlin [--force]
nettobreite osm   build  --region berlin [--dry-run]   # -> <region>_highways.fgb
nettobreite width build  --region berlin [--dry-run]   # -> <region>_nettobreite.fgb  (Notebook-1-Logik)
nettobreite tiles        --region berlin [--dry-run]   # -> nettobreite/<region>.pmtiles
nettobreite manifest                                   # -> data/manifest.json
nettobreite deploy [--dry-run]                         # b2 sync
nettobreite build-all    --region berlin               # Convenience: fetch->build->width->tiles->manifest
```
`--region` defaultet auf `regions.yaml:default_region` (= berlin).

---

## 6. Phasenplan (je ein kleiner Commit)

### Phase 0 — Gerüst (kein Daten-Verhalten)
- `pipeline/` anlegen; `pyproject.toml` (Name `nettobreite`, Deps aus Blaupause: geopandas/shapely/pyproj/pyogrio/pandas/pyarrow/requests/typer/pyyaml/pydantic(-settings)/tqdm; dev: ruff/pytest), `uv sync`.
- `config.py`, `cli.py` (nur `info` + Befehls-Stubs), `__init__.__version__`.
- `.env.example`, `.gitignore` (`data/`, `.env`); Mapillary-Token aus `config.public.js` nach `.env` (und **rotieren**).
- Symlink `./data -> pipeline/data`.
- **Akzeptanz:** `uv --directory pipeline run nettobreite info` zeigt Pfade + `default_region: berlin`. `uvx ruff check` grün.

### Phase 1 — OSM-Extraktion (Berlin)
- `regions.yaml` (nur berlin), `osm.yaml`, `osmconf_highways-widths.ini` nach `config/osmconf/` verschieben.
- `osm.py` (fetch/build, region-parametrisiert) portieren.
- **Akzeptanz:** `osm fetch --region berlin` lädt die Berlin-PBF; `osm build --region berlin` erzeugt `berlin_highways.fgb` mit plausibler Feature-Zahl (gegen Notebook-0-Output gegenprüfen). `--dry-run` zeigt nur Kommandos.

### Phase 2 — Nettobreite/CQI ⭐
- **`preprocessing/1_prepare_width_calc_berlin.ipynb` vollständig lesen.** Logik nach `width.py` portieren, Parameter nach `cqi.yaml`.
- Golden-Reference capturen (Berlin): Feature-Count + Histogramm der effektiven Breite über die Frontend-Kategorien.
- **Akzeptanz:** `width build --region berlin` erzeugt `berlin_nettobreite.fgb`; Verteilung **deckt sich mit dem Notebook-Output** (pytest gegen Golden). Spalten-Vertrag (§4) erfüllt.

### Phase 3 — Tiles
- `tiles.yaml` + `tiles.py` verdrahten; Layer-Name `nettobreite` (Frontend-Vertrag).
- **Akzeptanz:** `tiles --region berlin` erzeugt `data/nettobreite/berlin.pmtiles` (Layer-Name korrekt, in pmtiles.io prüfbar). Bestehendes Frontend rendert damit unverändert (Dateiname/Layer-Name in `addSources.js`/`addLayers.js` abgleichen, ggf. im selben Commit anpassen).

### Phase 4 — Manifest + Deploy + Local-first
- `sources.yaml`, `manifest.py`; `deploy.py` + `.env`.
- Frontend auf Local-first/B2 umstellen: `js/mapdata/resolveSources.js` aus der Blaupause übernehmen, `addSources.js` nutzt `resolveSources()`/`url(id)` statt fester URL. Bucket public + CORS (`range,content-type`).
- **Akzeptanz:** `manifest` schreibt `data/manifest.json` mit `vintage` (= PBF-Datum). `deploy --dry-run` listet nur geänderte Dateien. Frontend lädt lokal, fällt bei 404 auf B2.

### Phase 5 — Frontend-Feinschliff (siehe §7)
- Basemap-Panel unten links + Datenstand-Anzeige.

### Phase 6 — Aufräumen
- Notebooks nach `notebooks/exploration/` verschieben (mit `nbstripout` von Outputs befreien) oder entfernen.
- `readme.MD` aktualisieren (neue Pipeline, CLI, Quellen, keyless). Getrackte Großdateien `git rm --cached`.

---

## 7. Frontend-Feinschliff (Phase 5)

### 7.1 Basemap-Panel unten links (Hauptwunsch) — 1:1 aus der Blaupause
Ersetze den jetzigen `#bottom-left-ui-container` (Standard/Satellit-Thumbnails + Terrain/Hillshade-Checkboxen) durch das Karten-Panel aus `unfallkarte-2026`:

- **Markup** (`index.html`): `#map-settings-toggle` (44px-Button) + `#map-settings-panel.is-collapsed` mit:
  - `.basemap-grid` → drei `.basemap-btn[data-basemap="positron|osm|satellite"]` (je `.basemap-preview` + `.basemap-label`).
  - zwei `.terrain-row` mit `.switch`-Toggles: `#toggle-relief` (Geländerelief) und `#toggle-buildings` (3D-Gebäude).
- **CSS** (`style.css`): den Block `.map-settings-*` / `.basemap-grid` / `.basemap-btn` / `.basemap-preview(-positron|-osm|-satellite)` / `.terrain-row` / `.switch(-slider)` übernehmen (Blaupause `style.css` ~Z. 621–674). Vorschau-Thumbnails nach `thumbs/` legen.
- **Logik:** `js/map/basemapTerrain.js` aus der Blaupause übernehmen — **keyless**:
  - Basis = lokales Positron-`style.json`; OSM-Carto + Esri als Raster-Layer per `visibility` ein-/ausblenden (kein Style-Swap → Daten-Layer bleiben erhalten).
  - Terrain/Hillshade via Mapterhorn (`raster-dem`, `terrarium`), 3D-Gebäude via OpenFreeMap-Planet; **lazy** beim ersten Toggle laden.
  - Exporte `addBasemapTerrain / setBasemap / setRelief / setBuildings`.
  - Verdrahtung in `main.js` analog `setupMapPanel` der Blaupause (Panel-Toggle, `.basemap-btn`-Click → `setBasemap` + `.selected`, Relief/Buildings → `setRelief/setBuildings`).
- **Wichtig (Anpassung für nettobreite):** Beim Wechsel auf eine Raster-Basemap werden nur die **Positron-Host-Layer** (`source === "openmaptiles"` + background) versteckt. Stelle sicher, dass deine **Nettobreite-/Width-/Mapillary-Layer** andere Sources nutzen und daher sichtbar bleiben.
- `addBasemapTerrain(map)` **nach** `addSources`/`addLayers` aufrufen (Symbol-Reihenfolge steht dann).

### 7.2 Datenstand in der UI — manifestgetrieben
- `js/utils/applyDataVintages.js` aus der Blaupause übernehmen. Es liest `vintage` aus dem Manifest und füllt `[data-osm-vintage]`-Elemente.
- In `index.html` das hartkodierte „Datenstand: 9.11.2025" entfernen; das ⓘ-Icon wird `<span class="info-icon" data-osm-vintage="nettobreite_berlin">`.
- `applyDataVintages()` in `main.js` nach den Layern aufrufen. → Datum kommt künftig automatisch aus `osmium fileinfo` der jeweiligen Region-PBF.

### 7.3 (Optional, später) Region-Umschalter
Sobald mehr als Berlin gebaut ist: kleiner Region-Selector im Panel, der `center`/`bbox` aus dem Manifest setzt und die passende `nettobreite/<region>.pmtiles` lädt. **Jetzt noch nicht** — Scope ist Berlin.

---

## 8. Verifizieren (Sicherheitsnetz)

- **Golden-Reference** (`tests/golden/`): Berlin Feature-Count + Verteilung der effektiven Breite über die Frontend-Kategorien müssen stabil bleiben; `uv run pytest` ruft `golden.compare`.
- `uvx ruff check` grün, Code getippt und ruff-konform.
- **Frontend-Verify:** keine JS-Fehler in der Konsole; Layer laden Local-first bzw. B2; Panel schaltet Basemaps/Relief/Buildings korrekt; ⓘ-Datum kommt aus dem Manifest.

---

## 9. Referenz-Repos (Muster)

- `vizsim/unfallkarte` **@ `unfallkarte-2026`** → komplette Blaupause (Pipeline-Spine, Panel, Manifest/Local-first).
- `vizsim/gradients2osm` → Ursprung des Karten-Panels (OpenFreeMap + Mapterhorn, B2-Upload-Skript).
- `vizsim/hilo_profiler` → Panel-/Geocoder-Stil, Bottom-Left-Controls.

---

## 10. Offene Punkte / vor dem Start klären

1. **CQI-Logik (blockierend für `width.py`):** `1_prepare_width_calc_berlin.ipynb` lesen — exakte Default-Werte, Parking-/Cycleway-Abzüge, Plausibilitätsgrenze (`<2 m`). `cqi.yaml` damit füllen.
2. **Berlin-Geofabrik-URL verifizieren** (Pfad `europe/germany/berlin-latest.osm.pbf`).
3. **osmium-Filter an Notebook 0 angleichen** (welche `highway`-Klassen genau, motorway/trunk inkludiert?).
4. **Frontend-Layer-Name/Dateiname** in `addSources.js`/`addLayers.js` abgleichen, bevor `tiles.yaml` finalisiert wird.
5. **Lizenz/Bucket:** Bucket-Name + ob (wie Blaupause) AGPL-3.0 gewünscht ist — sonst weglassen.
6. **`parking:restriction`** (README-Limitation): in `width.py` mit aufnehmen oder bewusst als TODO belassen.
