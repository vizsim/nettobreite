# Exploration-Notebooks (Archiv)

Die ursprünglichen Jupyter-Notebooks, mit denen die Daten gebaut wurden. Sie sind
**abgelöst** durch die Python-Pipeline in [`../../pipeline/`](../../pipeline/):

- `0_prepare_network_pbf_get_highways.ipynb` → `pipeline/src/nettobreite/osm.py`
- `1_prepare_width_calc_berlin.ipynb` (CQI-/Nettobreite-Logik) → `pipeline/src/nettobreite/width.py`

Nur noch als Referenz/Provenance aufbewahrt (Outputs gestrippt). Für den produktiven
Build siehe `pipeline/README.md` (`nettobreite build-all --region berlin`).
