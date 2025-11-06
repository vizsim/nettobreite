# Nettobreite Visualisierung

Visualisierung der Straßennettobreite auf Basis von OpenStreetMap-Daten und der Berechnung des [Cycling Quality Index](https://www.osm-verkehrswende.org/cqi/)

---

## Hintergrund

Dieses Projekt visualisiert die effektive Straßennettobreite. Die Breitenwerte werden aus OpenStreetMap-Daten berechnet und mit der Methodik des Cycling Quality Index (CQI) ermittelt.

Die Darstellung zeigt verschiedene Breitenkategorien farbcodiert auf einer interaktiven Karte.

**Inspiration**: [OSM Diary Entry von Pieter Vander Vennet](https://www.openstreetmap.org/user/Pieter%20Vander%20Vennet/diary/407661)

### Ziele

- **Überholbreite für den Radverkehr darstellen** → Straßen identifizieren, wo de facto Überholverbot gilt
- **QA für OSM-Mapping** → Qualitätssicherung für die OSM-Tags:
  - `width` (Breite)
  - `parking` (Straßenbegleitendes Parken)

---

## Bekannte Limitationen & Offene Punkte

- **CQI-Logik**: Unklar, ob die Logik von CQI zu 100% übernommen wurde
- **Fehlende Tags**: Das Tag `parking:restriction` wird noch nicht berücksichtigt
- **Default-Werte**: Der Umgang mit Default-Werten könnte optimiert werden
- **Regionale Anpassung**: Unklar, ob die Default-Werte für ganz Deutschland passen
- siehe [issues](https://github.com/vizsim/nettobreite/issues)

---

## Datenquellen

- **Quelle**: OpenStreetMap Contributors
- **Datenstand**: 5.11.2025
- **Methodik**: Cycling Quality Index (CQI) – [osm-verkehrswende.org/cqi/](https://www.osm-verkehrswende.org/cqi/)


---

## Technische Details

- **Framework**: MapLibre GL JS
- **Datenformat**: PMTiles

---
