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
        // Wenn eines der missing-Flags True ist: schwarz
        ["any",
          ["==", ["get", "cycleway_missing"], true],
          ["==", ["get", "parking_missing"], true],
          ["==", ["get", "widths_missing"], true]
        ],
        "#000000",  // Schwarz für missing data
        // Wenn width_effective nicht vorhanden: schwarz (keine Breite angegeben)
        ["!", ["has", "width_effective"]],
        "#000000",  // Schwarz für keine Breite angegeben
        // Wenn width_effective < 2: grau (nicht plausibel)
        ["<", ["get", "width_effective"], 2],
        "#808080",  // Grau für nicht plausibel
        // Sonst: normale Interpolation
        [
          "interpolate",
          ["linear"],
          ["get", "width_effective"],
          2, "#cc0000",    // Rot für sehr schmal (ab 2m)
          2.5, "#dd0000",  // Dunkelrot
          3, "#ff3300",    // Rot-Orange
          3.5, "#ff5500",  // Rot-Orange
          4, "#ff7700",    // Orange
          4.5, "#ff9900",  // Orange-Gelb
          5, "#ffbb00",    // Gelb-Orange (noch etwas röter)
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
        9, 0.4,
        12, 1.6,
        15, 5,
        18, 8
      ],
      "line-opacity": 0.8
    }
  });



  

  function addMapillaryLayer(map) {
    // ⬇️ Soft halo for pano
    map.addLayer({
      id: "mapillary-images-halo",
      type: "circle",
      source: "mapillary-images",
      "source-layer": "image",
      minzoom: 14,
      maxzoom: 21,
      layout: {
        visibility: "none"
      },
      filter: ["==", ["to-string", ["get", "is_pano"]], "true"],
      paint: {
        "circle-color": "#0077ff",
        "circle-radius": [
          "interpolate", ["linear"], ["zoom"],
          14, 6,
          15, 8,
          17, 10
        ],
        "circle-opacity": 0.3
      }
    });

    // ⬆️ Main circle on top
    map.addLayer({
      id: "mapillary-images-layer",
      type: "circle",
      source: "mapillary-images",
      "source-layer": "image",
      minzoom: 14,
      maxzoom: 21,
      layout: {
        visibility: "none"
      },
      paint: {
        "circle-color": [
          "match",
          ["to-string", ["get", "is_pano"]],
          "true", "#0077ff",
          "false", "#00b955",
          "#999999"
        ],
        "circle-radius": [
          "interpolate", ["linear"], ["zoom"],
          14, 3,
          16, 4,
          17, 5
        ]
      }
    });
  }
  
  addMapillaryLayer(map);




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
