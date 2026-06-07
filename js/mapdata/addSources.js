export function addSources(map, { MAPTILER_API_KEY, MAPILLARY_TOKEN }) {
  // SOURCES

  // PMTiles-Hosting: vorerst GitHub (von der Pipeline nach pipeline/data/ gebaut
  // und in git getrackt). B2 kommt erst bei ganz-Deutschland (TODO).
  // prod: githubusercontent raw; lokale Entwicklung: "./data/" (Symlink -> pipeline/data).
  // const pmtilesBaseURL = "https://f003.backblazeb2.com/file/nettobreite/";  // TODO B2
  const pmtilesBaseURL = "https://raw.githubusercontent.com/vizsim/nettobreite/main/pipeline/data/";
  // const pmtilesBaseURL = "./data/";  // lokale Entwicklung

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

    

  // Raster: Satellite ESRI
  map.addSource("satellite", {
    type: "raster",
    tiles: [
      "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
    ],
    tileSize: 256,
    attribution: "Tiles © Esri — Source: Esri, Maxar, Earthstar Geographics, and the GIS User Community"
  });

  // Raster: Hillshade
  map.addSource("hillshade", {
    type: "raster",
    url: `https://api.maptiler.com/tiles/hillshades/tiles.json?key=${MAPTILER_API_KEY}`,
    tileSize: 256,
    attribution: "© MapTiler"
  });
  
  // Raster-DEM: Terrain
  map.addSource("terrain", {
    type: "raster-dem",
    url: `https://api.maptiler.com/tiles/terrain-rgb-v2/tiles.json?key=${MAPTILER_API_KEY}`,
    tileSize: 256,
    encoding: "mapbox",
    attribution: "© MapTiler"
  });
}
