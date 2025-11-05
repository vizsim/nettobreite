export function addSources(map, { MAPTILER_API_KEY, MAPILLARY_TOKEN }) {
  // SOURCES

 // const pmtilesBaseURL = "https://f003.backblazeb2.com/file/nettobreite/";

   // github
  const pmtilesBaseURL = "https://raw.githubusercontent.com/vizsim/nettobreite/main/data/";
  // local
  //const pmtilesBaseURL = "./data/";

  const addPMTilesSource = (id, filename) => {
    if (!map.getSource(id)) {
      map.addSource(id, {
        type: "vector",
        url: `pmtiles://${pmtilesBaseURL}${filename}`
      });
    }
  };

  // Nettobreite layer source
 // addPMTilesSource("nettobreite", "demo_nettobreite.pmtiles");
  addPMTilesSource("nettobreite", "berlin_nettobreite.pmtiles");


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
