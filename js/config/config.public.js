// config.public.js — öffentlich (committed). Enthält bewusst KEINE Server-Secrets.
//
// MapTiler entfällt komplett (keyless: Basemap via OpenFreeMap, Terrain via Mapterhorn).
//
// Mapillary-Token: clientseitig zwangsläufig öffentlich (steckt im JS-Bundle).
// TODO Sicherheit: dieser Token liegt seit jeher im git-Verlauf offen → in der
// Mapillary-Developer-Konsole rotieren (alten widerrufen) und hier ersetzen.
export const MAPILLARY_TOKEN = "MLY|27225179307135493|89b2893ee420968a46c62983011a66ea";
