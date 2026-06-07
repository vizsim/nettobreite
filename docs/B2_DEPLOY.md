# PMTiles-Deploy über Backblaze B2 (geplant, noch nicht umgesetzt)

**Status: TODO.** Aktuell werden die fertigen PMTiles **über GitHub** ausgeliefert
(in git getrackt, `js/mapdata/addSources.js` lädt von githubusercontent). Das ist
für **Berlin** ok. Sobald die Pipeline auf **Bundesländer / ganz Deutschland**
ausgeweitet wird, werden die `.pmtiles` zu groß fürs Repo → Umzug nach **B2**.

Dieses Dokument beschreibt den Umbau. Vieles ist schon vorbereitet:

- `pipeline/src/nettobreite/config.py` kennt `b2_application_key_id`,
  `b2_application_key`, `b2_bucket_name` (Default `nettobreite-data`).
- `pipeline/.env.example` hat die B2-Felder.
- `pipeline/src/nettobreite/manifest.py` erzeugt `data/manifest.json` mit `file` +
  `present` je Layer — genau das, was der Frontend-Local-first-Resolver braucht.
- `nettobreite deploy` existiert als **CLI-Stub** ([cli.py](../pipeline/src/nettobreite/cli.py)).

Blaupause mit fertiger Implementierung: **`vizsim/unfallkarte` @ `unfallkarte-2026`**
(`pipeline/src/unfallkarte/deploy.py`, `js/mapdata/resolveSources.js`).

---

## Schritt 1 — Bucket + App-Key in B2 anlegen

- Bucket anlegen (z. B. `nettobreite-data`), **public** (Files öffentlich lesbar).
- **CORS** erlauben: Header `range` + `content-type` (PMTiles macht HTTP-Range-Requests),
  Methoden `GET`/`HEAD`, Origin `*` (oder die Deploy-Domain).
- Einen **Application Key** anlegen, auf diesen Bucket beschränkt, **Read+Write** —
  NICHT den Master-Key. Der `applicationKey` wird nur einmal angezeigt.

## Schritt 2 — b2-CLI + .env

```bash
uv tool install b2                 # b2-CLI (nicht via pip ins Paket)
cp pipeline/.env.example pipeline/.env
# in pipeline/.env eintragen:
#   B2_APPLICATION_KEY_ID=...
#   B2_APPLICATION_KEY=...
#   B2_BUCKET_NAME=nettobreite-data
```

## Schritt 3 — `pipeline/src/nettobreite/deploy.py` anlegen

`b2 sync` spiegelt den lokalen `data/`-Baum 1:1 ins Bucket und lädt nur Geändertes.
Nur `*.pmtiles` + `manifest.json` hochladen, Zwischenstände (PBF/FGB) bleiben lokal.
(1:1 aus der Blaupause, `unfallkarte` → `nettobreite`.)

```python
"""Deploy: PMTiles + manifest.json via `b2 sync` ins B2-Bucket. Secrets aus .env;
Keys werden nie im Klartext geloggt."""
from __future__ import annotations
import subprocess
from shutil import which
from nettobreite.config import get_paths, get_settings

_INCLUDE = [r".*\.pmtiles$", r".*manifest\.json$"]

def _sync_cmd(bucket: str, *, dry_run: bool) -> list[str]:
    cmd = ["b2", "sync", "--no-progress", "--exclude-regex", ".*"]
    for inc in _INCLUDE:
        cmd += ["--include-regex", inc]
    if dry_run:
        cmd.append("--dry-run")
    cmd += [str(get_paths().data), f"b2://{bucket}"]
    return cmd

def sync(*, dry_run: bool = False, bucket: str | None = None) -> None:
    s = get_settings()
    bucket = bucket or s.b2_bucket_name
    cmd = _sync_cmd(bucket, dry_run=dry_run)
    if dry_run or which("b2") is None:
        reason = "dry-run" if dry_run else "'b2' nicht installiert"
        print(f"  [{reason}] {' '.join(cmd)}")
        return
    missing = [k for k, v in {
        "B2_APPLICATION_KEY_ID": s.b2_application_key_id,
        "B2_APPLICATION_KEY": s.b2_application_key,
    }.items() if not v]
    if missing:
        raise RuntimeError(f"Fehlende .env-Werte: {missing}")
    subprocess.run(["b2", "account", "authorize", s.b2_application_key_id, s.b2_application_key], check=True)
    subprocess.run(cmd, check=True)
```

Den CLI-Stub in [cli.py](../pipeline/src/nettobreite/cli.py) verdrahten:

```python
@app.command()
def deploy(dry_run: bool = typer.Option(False, "--dry-run"),
           bucket: str = typer.Option(None, "--bucket")) -> None:
    from nettobreite import deploy as deploy_mod
    deploy_mod.sync(dry_run=dry_run, bucket=bucket)
    typer.secho("deploy abgeschlossen.", fg=typer.colors.GREEN)
```

Dann: `nettobreite deploy --dry-run` (zeigt nur das Kommando), danach `nettobreite deploy`.

## Schritt 4 — PMTiles aus dem git-Tracking nehmen

Beim GitHub-Hosting wurden die finalen PMTiles bewusst getrackt. Mit B2 sollen sie
nur noch im Bucket liegen:

```bash
git rm --cached pipeline/data/nettobreite/*.pmtiles
```

In [pipeline/.gitignore](../pipeline/.gitignore) die GitHub-Ausnahmen entfernen,
sodass `data/` wieder vollständig ignoriert ist (Block „Ausnahmen … PMTiles
über GitHub"):

```diff
-!data/nettobreite/
-data/nettobreite/*
-!data/nettobreite/*.pmtiles
```

`!data/manifest.json` kann bleiben (klein) — oder ebenfalls nur via B2 ausliefern.

## Schritt 5 — Frontend auf Local-first + B2-Fallback

`js/mapdata/resolveSources.js` aus der Blaupause übernehmen: lädt `manifest.json`,
prüft je Datei lokal per `HEAD` und fällt bei 404 auf B2 zurück. Liefert `url(id)`.

- `js/mapdata/addSources.js`: statt der festen githubusercontent-`pmtilesBaseURL`
  den Resolver nutzen — `const sources = await resolveSources();` und
  `url: sources.url("nettobreite_berlin")`. (Die manifest-IDs kommen aus
  `pipeline/config/sources.yaml`.)
- `js/utils/applyDataVintages.js`: die `REMOTE_BASE`-Konstante (aktuell die
  githubusercontent-URL) auf die **B2-Bucket-URL** umstellen.

**B2-Public-URL** = `https://f003.backblazeb2.com/file/<bucket>/` (oder eine
Custom-Domain/CDN, z. B. `https://tiles.vizsim.de/file/<bucket>/`). Diese eine
Basis-URL an den o. g. Stellen setzen.

## Schritt 6 — Verifizieren

- `nettobreite deploy --dry-run` listet nur die geänderten `*.pmtiles` + `manifest.json`.
- Bucket public + CORS ok: ein `curl -I -H "Range: bytes=0-99" <bucket-url>/nettobreite/<region>.pmtiles`
  liefert `206 Partial Content`.
- Frontend: Layer lädt lokal (Dev) bzw. aus B2 (Prod); Datenstand kommt weiter aus
  dem Manifest; keine 404/CORS-Fehler in der Konsole.

---

## Checkliste

- [ ] B2-Bucket (public) + scoped App-Key, CORS `range,content-type`
- [ ] `uv tool install b2`, `pipeline/.env` gefüllt
- [ ] `deploy.py` + CLI-`deploy` verdrahtet, `--dry-run` getestet
- [ ] PMTiles aus git genommen (`git rm --cached`) + `.gitignore`-Ausnahmen entfernt
- [ ] `resolveSources.js` übernommen, `addSources.js` + `applyDataVintages.js` umgestellt
- [ ] B2-Public-URL/CDN gesetzt, Range-Request liefert 206, Frontend ohne Fehler
