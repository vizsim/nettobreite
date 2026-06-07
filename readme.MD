# Nettobreite Visualisierung

Visualisierung der Straßen­nettobreite auf Basis von OpenStreetMap-Daten und der
Berechnung des [Cycling Quality Index](https://www.osm-verkehrswende.org/cqi/).

---

## Hintergrund

Dieses Projekt visualisiert die effektive Straßen­nettobreite. Die Breitenwerte
werden aus OpenStreetMap-Daten berechnet und mit der Methodik des Cycling Quality
Index (CQI) ermittelt. Die Darstellung zeigt verschiedene Breiten­kategorien
farbcodiert auf einer interaktiven Karte.

**Inspiration**: [OSM Diary Entry von Pieter Vander Vennet](https://www.openstreetmap.org/user/Pieter%20Vander%20Vennet/diary/407661)

### Ziele

- **Überholbreite für den Radverkehr darstellen** → Straßen identifizieren, wo de facto Überholverbot gilt
- **QA für OSM-Mapping** → Qualitätssicherung für die OSM-Tags `width`, `parking`, `cycleway`

---

## Pipeline

Die Daten werden von einer getypten, getesteten Python-Pipeline (uv-Paket
`nettobreite`) gebaut — siehe **[`pipeline/README.md`](pipeline/README.md)**. Sie
löst die früheren Jupyter-Notebooks ab (archiviert unter
[`notebooks/exploration/`](notebooks/exploration/)).

```bash
uv --directory pipeline run nettobreite build-all --region berlin
# fetch → osm build → width build → tiles → manifest
```

Ablauf: Geofabrik-PBF → `osmium`-Vorfilter (Highway-Klassen) → `pyogrio` liest die
Linien direkt → CQI-/Nettobreite-Berechnung → `tippecanoe` → PMTiles + `manifest.json`.
Die Region ist die einzige Skalierungs­achse (`config/regions.yaml`); weitere
Bundesländer/Deutschland = ein weiterer YAML-Block.

Die finalen PMTiles werden derzeit **über GitHub** ausgeliefert; ein Umzug auf
**Backblaze B2** ist für die Deutschland-weite Variante vorgesehen (TODO).

---

## Bekannte Limitationen & Offene Punkte

- **CQI-Logik**: Unklar, ob die Logik von CQI zu 100 % übernommen wurde.
- **Default-Werte**: Annahmen (Park-/Radspur-Breiten etc.) liegen in
  `pipeline/config/cqi.yaml` und sind regional überschreibbar; ob sie für ganz
  Deutschland passen, ist offen.
- `parking:restriction` wird inzwischen berücksichtigt (jeder gesetzte Wert außer
  `none`/`no` unterdrückt den Parkabzug der Seite).
- siehe [issues](https://github.com/vizsim/nettobreite/issues)

---

## Datenquellen

- **Quelle**: OpenStreetMap Contributors (ODbL)
- **Datenstand**: dynamisch aus `data/manifest.json` (= `osmium fileinfo` der
  jeweiligen Region-PBF), wird in der UI angezeigt.
- **Methodik**: Cycling Quality Index (CQI) – [osm-verkehrswende.org/cqi/](https://www.osm-verkehrswende.org/cqi/)

---

## Technische Details

- **Frontend**: MapLibre GL JS, **keyless** — Basemap via
  [OpenFreeMap](https://openfreemap.org/), Terrain/Hillshade via
  [Mapterhorn](https://mapterhorn.com/). Kein API-Key im Code.
- **Datenformat**: PMTiles (Vektor-Layer `nettobreite-lines`).
- **Pipeline**: Python (uv) — geopandas/pyogrio/shapely/typer; System-Binaries
  `osmium-tool`, `tippecanoe`.
