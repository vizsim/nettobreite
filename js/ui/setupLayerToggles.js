
// setupLayerToggles.js

// export function setupLayerToggles(map, applyZoomLock, applyLegendVisibility) {



import { applyZoomLock } from "../utils/zoomLock.js";



export function setupToggle(map, checkboxId, layerIds, applyZoomLock, applyLegendVisibility) {
  const checkbox = document.getElementById(checkboxId);
  if (!checkbox) return;

  checkbox.addEventListener("change", (e) => {
    const visibility = e.target.checked ? "visible" : "none";

    layerIds.forEach(layerId => {
      if (map.getLayer(layerId)) {
        map.setLayoutProperty(layerId, "visibility", visibility);
      }
    });

    applyZoomLock();
    applyLegendVisibility();
  });
}

export function setupBikeLanesToggle(map) {
  const checkbox = document.getElementById("toggle-bikelanes");
  if (!checkbox) return;

  // Bike lanes layer IDs
  const bikeLanesLayerIds = [
    "bike-lanes-needsClarification",
    "bike-lanes-gehweg", 
    "bike-lanes-kfz",
    "bike-lanes-fussverkehr",
    "bike-lanes-eigenstaendig",
    "bike-lanes-baulich",
    "bike-lanes-hitarea"
  ];

  checkbox.addEventListener("change", (e) => {
    const visibility = e.target.checked ? "visible" : "none";
    const legendOptions = document.getElementById("bikelanes-legend-options");
    
    // Toggle all bike lanes layers
    bikeLanesLayerIds.forEach(layerId => {
      if (map.getLayer(layerId)) {
        map.setLayoutProperty(layerId, "visibility", visibility);
      }
    });

    // Show/hide legend options
    if (legendOptions) {
      legendOptions.style.display = e.target.checked ? "block" : "none";
    }
  });

  // Set initial state to hidden
  bikeLanesLayerIds.forEach(layerId => {
    if (map.getLayer(layerId)) {
      map.setLayoutProperty(layerId, "visibility", "none");
    }
  });
}



export function setupLayerToggles(map, originalMinZoom, setCurrentZoomLock, applyLegendVisibility) {
  const zoomLock = () => applyZoomLock(map, originalMinZoom, setCurrentZoomLock);


  // Einfachere Handhabung der Layer



  // Koeffizienten-Raster Layer
  setupToggle(map, "toggle-coeff-rasters", ["coeff_rasters"], zoomLock, applyLegendVisibility);
  
  // Isochronen Layer - optimized without unnecessary recalculations
  setupToggle(map, "toggle-isos", ["isos_bike", "isos_cargo_bike", "isos_my_bike_cycleways"], () => {}, () => {});
  
  // Special handling for isochrones to clear filters when disabled
  const isosCheckbox = document.getElementById("toggle-isos");
  if (isosCheckbox) {
    isosCheckbox.addEventListener("change", (e) => {
      if (!e.target.checked) {
        // Clear all isochrone filters when disabled
        map.setFilter("isos_bike", ["==", "id", ""]);
        map.setFilter("isos_cargo_bike", ["==", "id", ""]);
        map.setFilter("isos_my_bike_cycleways", ["==", "id", ""]);
      }
    });
  }

  // Bike Lanes Layer
  setupBikeLanesToggle(map);







}
