export function addSources(map, { MAPILLARY_TOKEN }) {
  // SOURCES

  // PMTiles-Hosting: lokal aus "./data/" (Symlink -> pipeline/data, von der Pipeline
  // gebaut), sonst von GitHub (in git getrackt). B2 erst bei ganz-Deutschland (TODO).
  // const pmtilesBaseURL = "https://f003.backblazeb2.com/file/nettobreite/";  // TODO B2
  const isLocalhost = ["localhost", "127.0.0.1"].includes(location.hostname);
  const pmtilesBaseURL = isLocalhost
    ? "./data/"
    : "https://raw.githubusercontent.com/vizsim/nettobreite/main/pipeline/data/";

  const addPMTilesSource = (id, filename) => {
    if (!map.getSource(id)) {
      map.addSource(id, {
        type: "vector",
        url: `pmtiles://${pmtilesBaseURL}${filename}`
      });
    }
  };

  // Nettobreite layer source (Layer-Name im PMTiles: "nettobreite-lines")
  addPMTilesSource("nettobreite", "nettobreite/berlin.pmtiles");


    // Mapillary
    map.addSource("mapillary-images", {
      type: "vector",
      tiles: [
        `https://tiles.mapillary.com/maps/vtp/mly1_public/2/{z}/{x}/{y}?access_token=${MAPILLARY_TOKEN}`
      ],
      minzoom: 14,
      // maxzoom: 14.99
      maxzoom: 14,
    });

  // Raster-Basemaps (Esri/OSM-Carto) + Terrain/Hillshade (Mapterhorn) liegen jetzt
  // keyless in js/map/basemapTerrain.js (kein MapTiler mehr).
}
