// setupIsochroneInteraction.js

// Function to setup hover and click interaction for isochrones
export function setupIsochroneInteraction(map) {
  // Store current hovered ID and clicked ID
  let currentHoveredId = null;
  let clickedId = null;
  let hoverTimeout = null;
  
  // Cache the current layer type to avoid repeated DOM queries
  let currentLayerType = 'bike';
  
  // Function to get current layer type from radio selection
  const getCurrentLayerType = () => {
    return currentLayerType;
  };
  
  // Update layer type when radio changes
  const updateCurrentLayerType = (value) => {
    if (value.startsWith('diff_')) {
      currentLayerType = null;
    } else {
      currentLayerType = value.replace('coeff_', '');
    }
  };
  
  // Export the update function so it can be called from outside
  window.updateCurrentLayerType = updateCurrentLayerType;
  
  // Function to update isos when mode changes
  const updateIsosForCurrentMode = () => {
    if (clickedId) {
      // If there's a clicked ID, show the isos for the current mode
      showIsosForId(clickedId);
    }
  };
  
  // Export the update function
  window.updateIsosForCurrentMode = updateIsosForCurrentMode;
  
  // Cache current visible layer to avoid unnecessary setLayoutProperty calls
  let currentVisibleLayer = null;
  
  // Function to show isos with current layer type
  const showIsosForId = (id) => {
    const layerType = getCurrentLayerType();
    
    // Don't show isos for diff layers
    if (layerType === null) {
      // Hide all isos layers only if any are currently visible
      if (currentVisibleLayer) {
        map.setLayoutProperty(currentVisibleLayer, "visibility", "none");
        currentVisibleLayer = null;
      }
      return;
    }
    
    const layerId = `isos_${layerType}`;
    
    // Only hide previous layer if it's different from the new one
    if (currentVisibleLayer && currentVisibleLayer !== layerId) {
      map.setLayoutProperty(currentVisibleLayer, "visibility", "none");
    }
    
    // Show the new layer and set filter
    map.setFilter(layerId, ["==", "id", id]);
    map.setLayoutProperty(layerId, "visibility", "visible");
    currentVisibleLayer = layerId;
  };
  
  // Cache hover checkbox state to avoid DOM queries
  let isHoverEnabled = false;
  const updateHoverState = () => {
    const isosHoverCheckbox = document.getElementById('toggle-isos-hover');
    isHoverEnabled = isosHoverCheckbox && isosHoverCheckbox.checked;
  };
  
  // Initialize hover state
  updateHoverState();
  
  // Check if isochrones are enabled
  const areIsochronesEnabled = () => {
    const isosCheckbox = document.getElementById('toggle-isos');
    return isosCheckbox && isosCheckbox.checked;
  };

  // Debounced function to handle hover with delay
  const debouncedHover = (id) => {
    // Clear existing timeout
    if (hoverTimeout) {
      clearTimeout(hoverTimeout);
      hoverTimeout = null;
    }
    
    // Set new timeout for delayed hover processing
    hoverTimeout = setTimeout(() => {
      // Only show isos on hover if no ID is clicked AND hover is enabled AND isochrones are enabled
      if (!clickedId && isHoverEnabled && areIsochronesEnabled()) {
        showIsosForId(id);
      }
    }, 200); // Increased delay to 200ms for better performance
  };
  
  // Cache border properties to avoid repeated setPaintProperty calls
  let borderWidthSet = false;
  let borderColorSet = false;
  
  // Hover events on coeff_rasters
  map.on("mousemove", "coeff_rasters", (e) => {
    const id = e.features[0].properties.id;
    
    // Only update if ID changed to avoid unnecessary operations
    if (currentHoveredId !== id) {
      currentHoveredId = id;
      
      // Add thick black border on hover - filter to only show the hovered feature
      map.setFilter("coeff_rasters_border", ["==", "id", id]);
      
      // Only set paint properties once, not on every hover
      if (!borderWidthSet) {
        map.setPaintProperty("coeff_rasters_border", "line-width", 3);
        borderWidthSet = true;
      }
      if (!borderColorSet) {
        map.setPaintProperty("coeff_rasters_border", "line-color", "rgba(0, 0, 0, 1)");
        borderColorSet = true;
      }
      
      // Use debounced hover for isos
      debouncedHover(id);
    }
  });
  
  // Click events on coeff_rasters
  map.on("click", "coeff_rasters", (e) => {
    // Only handle clicks if isochrones are enabled
    if (!areIsochronesEnabled()) return;
    
    const id = e.features[0].properties.id;
    
    if (clickedId === id) {
      // If clicking the same ID, hide isos and remove blue border
      clickedId = null;
      map.setLayoutProperty("isos_bike", "visibility", "none");
      map.setLayoutProperty("isos_cargo_bike", "visibility", "none");
      map.setLayoutProperty("isos_my_bike_cycleways", "visibility", "none");
      
      // Remove blue border
      map.setFilter("coeff_rasters_clicked", ["==", "id", ""]);
    } else {
      // If clicking different ID, show its isos and blue border
      clickedId = id;
      showIsosForId(id);
      
      // Show blue border for clicked tile
      map.setFilter("coeff_rasters_clicked", ["==", "id", id]);
    }
  });
  
  // Hide isos when leaving coeff_rasters (only if not clicked)
  map.on("mouseleave", "coeff_rasters", () => {
    // Clear any pending hover timeout
    if (hoverTimeout) {
      clearTimeout(hoverTimeout);
      hoverTimeout = null;
    }
    
    // Remove thick black border on mouse leave - clear filter to hide all borders
    map.setFilter("coeff_rasters_border", ["==", "id", ""]);
    
    // Reset border properties only if they were set
    if (borderWidthSet) {
      map.setPaintProperty("coeff_rasters_border", "line-width", 0);
      borderWidthSet = false;
    }
    if (borderColorSet) {
      map.setPaintProperty("coeff_rasters_border", "line-color", "rgba(0, 0, 0, 0)");
      borderColorSet = false;
    }
    
    if (!clickedId) {
      map.setLayoutProperty("isos_bike", "visibility", "none");
      map.setLayoutProperty("isos_cargo_bike", "visibility", "none");
      map.setLayoutProperty("isos_my_bike_cycleways", "visibility", "none");
      currentHoveredId = null;
    }
  });
  
  // Add click handler to map to clear selection when clicking elsewhere
  map.on("click", (e) => {
    // Check if click was on coeff_rasters layer
    const features = map.queryRenderedFeatures(e.point, { layers: ["coeff_rasters"] });
    if (features.length === 0) {
      // Clicked outside coeff_rasters, clear selection
      clickedId = null;
      map.setLayoutProperty("isos_bike", "visibility", "none");
      map.setLayoutProperty("isos_cargo_bike", "visibility", "none");
      map.setLayoutProperty("isos_my_bike_cycleways", "visibility", "none");
      
      // Remove blue border
      map.setFilter("coeff_rasters_clicked", ["==", "id", ""]);
    }
  });
  
  // Listen for layer selection changes to update isos
  // Use cached layer radios from main.js if available, otherwise query them
  const layerRadios = window.getLayerRadios ? window.getLayerRadios() : document.querySelectorAll('input[name="layer-selection"]');
  layerRadios.forEach(radio => {
    radio.addEventListener('change', () => {
      // If there's a clicked ID, update the isos for that ID with new layer type
      if (clickedId) {
        showIsosForId(clickedId);
      }
    });
  });
  
  // Listen for hover checkbox changes to update hover state
  const isosHoverCheckbox = document.getElementById('toggle-isos-hover');
  if (isosHoverCheckbox) {
    isosHoverCheckbox.addEventListener('change', updateHoverState);
  }
}
