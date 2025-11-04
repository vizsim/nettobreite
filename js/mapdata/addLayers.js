export function addLayers(map) {
  // Add nettobreite line layer
  map.addLayer({
    id: "nettobreite",
    type: "line",
    source: "nettobreite",
    "source-layer": "nettobreite-lines",
    minzoom: 9,
    maxzoom: 22,
    layout: {
      visibility: "visible",
      "line-cap": "round",
      "line-join": "round"
    },
    paint: {
      "line-color": [
        "case",
        // Wenn width_effective nicht vorhanden: schwarz (keine Breite angegeben)
        ["!", ["has", "width_effective"]],
        "#000000",  // Schwarz für keine Breite angegeben
        // Wenn width_effective < 1: grau (nicht plausibel)
        ["<", ["get", "width_effective"], 1],
        "#808080",  // Grau für nicht plausibel
        // Sonst: normale Interpolation
        [
          "interpolate",
          ["linear"],
          ["get", "width_effective"],
          1, "#cc0000",    // Rot für sehr schmal (ab 1m)
          2, "#ff3300",    // Rot-Orange
          3, "#ff6600",    // Orange
          4, "#ff9900",    // Orange-Gelb
          4.5, "#ffcc00",  // Gelb-Orange
          5, "#ffdd00",    // Gelb
          5.5, "#ccff00",  // Gelb-Grün
          6, "#99ff00",    // Grün-Gelb
          7, "#66ff00",    // Grün
          8, "#00cc00",    // Dunkelgrün
          10, "#00cc00"    // Grün für breit
        ]
      ],
      "line-width": [
        "interpolate",
        ["linear"],
        ["zoom"],
        9, 1,
        12, 3,
        15, 4,
        18, 6
      ],
      "line-opacity": 0.8
    }
  });

  // Raster layers
  map.addLayer({
    id: "satellite-layer",
    type: "raster",
    source: "satellite",
    layout: { visibility: "none" }
  }, "nettobreite");

  // Hillshade layer
  map.addLayer({
    id: "hillshade-layer",
    type: "raster",
    source: "hillshade",
    layout: { visibility: "none" },
    paint: {
      "raster-opacity": 0.3
    }
  });

  // Disable terrain initially
  map.setTerrain(null);
}
