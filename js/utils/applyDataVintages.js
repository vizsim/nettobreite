// js/utils/applyDataVintages.js
//
// Füllt die Datenstand-Tooltips (info-icon) dynamisch aus dem Manifest, statt ein
// hartkodiertes Datum im HTML zu pflegen. `vintage` kommt aus `osmium fileinfo`
// der Geofabrik-PBF (siehe pipeline/manifest.py), z.B. "2026-06-06".
// Markup: <span class="info-icon" data-osm-vintage="<manifest-id>">.
//
// B2/Local-first (resolveSources.js) ist vertagt -> das Manifest wird hier direkt
// geladen: lokal aus ./data (Symlink -> pipeline/data), sonst von githubusercontent.

const REMOTE_BASE =
  "https://raw.githubusercontent.com/vizsim/nettobreite/main/pipeline/data/";

function manifestUrls() {
  const isLocalhost = ["localhost", "127.0.0.1"].includes(location.hostname);
  return isLocalhost
    ? ["./data/manifest.json", `${REMOTE_BASE}manifest.json`]
    : [`${REMOTE_BASE}manifest.json`, "./data/manifest.json"];
}

export async function loadManifest() {
  for (const url of manifestUrls()) {
    try {
      const res = await fetch(url, { cache: "no-cache" });
      if (res.ok) return await res.json();
    } catch {
      /* nächste Quelle versuchen */
    }
  }
  console.warn("[applyDataVintages] manifest nicht ladbar");
  return {};
}

// "2026-06-06" -> "6.6.2026" (deutsches Format wie bisher im UI)
function germanDate(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || "");
  if (!m) return iso;
  return `${Number(m[3])}.${Number(m[2])}.${m[1]}`;
}

export async function applyDataVintages(manifest) {
  const mf = manifest || (await loadManifest());
  document.querySelectorAll("[data-osm-vintage]").forEach((el) => {
    const id = el.getAttribute("data-osm-vintage");
    const vintage = mf && mf[id] && mf[id].vintage;
    if (vintage) {
      el.title = `Quelle: OpenStreetMap Contributors – Datenstand: ${germanDate(vintage)}`;
    }
  });
}
