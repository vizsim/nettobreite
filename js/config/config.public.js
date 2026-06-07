// config.public.js — öffentlich (committed). Enthält bewusst KEINE Server-Secrets.
//
// MapTiler entfällt komplett (keyless: Basemap via OpenFreeMap, Terrain via Mapterhorn).
//
// Mapillary-Token: clientseitig zwangsläufig öffentlich (steckt im JS-Bundle).
// TODO Sicherheit: dieser Token liegt seit jeher im git-Verlauf offen → in der
// Mapillary-Developer-Konsole rotieren (alten widerrufen) und hier ersetzen.
export const MAPILLARY_TOKEN = "MLY|9558529790906210|c56bb62aff46b0a53a953e704ccd63de";
