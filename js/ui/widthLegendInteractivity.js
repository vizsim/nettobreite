// widthLegendInteractivity.js
// Handles interactive legend for width categories

// Map of width ranges to their filter conditions
const WIDTH_RANGE_FILTERS = {
  "not-plausible": ["all",
    ["has", "width_effective"],
    [">=", ["get", "width_effective"], 0],
    ["<", ["get", "width_effective"], 2]
  ],
  "very-narrow": ["all",
    ["has", "width_effective"],
    [">=", ["get", "width_effective"], 2],
    ["<", ["get", "width_effective"], 3]
  ],
  "narrow-3-4": ["all",
    ["has", "width_effective"],
    [">=", ["get", "width_effective"], 3],
    ["<", ["get", "width_effective"], 4]
  ],
  "narrow-4-45": ["all",
    ["has", "width_effective"],
    [">=", ["get", "width_effective"], 4],
    ["<", ["get", "width_effective"], 4.5]
  ],
  "narrow-45-5": ["all",
    ["has", "width_effective"],
    [">=", ["get", "width_effective"], 4.5],
    ["<", ["get", "width_effective"], 5]
  ],
  "restricted-5-55": ["all",
    ["has", "width_effective"],
    [">=", ["get", "width_effective"], 5],
    ["<", ["get", "width_effective"], 5.5]
  ],
  "sufficient-55-6": ["all",
    ["has", "width_effective"],
    [">=", ["get", "width_effective"], 5.5],
    ["<", ["get", "width_effective"], 6]
  ],
  "wide-6-7": ["all",
    ["has", "width_effective"],
    [">=", ["get", "width_effective"], 6],
    ["<", ["get", "width_effective"], 7]
  ],
  "very-wide-7-8": ["all",
    ["has", "width_effective"],
    [">=", ["get", "width_effective"], 7],
    ["<", ["get", "width_effective"], 8]
  ],
  "very-wide-8plus": ["all",
    ["has", "width_effective"],
    [">=", ["get", "width_effective"], 8]
  ],
  "cycleway-missing": ["any",
    ["==", ["get", "cycleway_missing"], true],
    ["==", ["get", "cycleway_missing"], "true"],
    ["==", ["get", "cycleway_missing"], 1]
  ],
  "parking-missing": ["any",
    ["==", ["get", "parking_missing"], true],
    ["==", ["get", "parking_missing"], "true"],
    ["==", ["get", "parking_missing"], 1]
  ],
  "widths-missing": ["any",
    ["==", ["get", "widths_missing"], true],
    ["==", ["get", "widths_missing"], "true"],
    ["==", ["get", "widths_missing"], 1]
  ]
};

// Track disabled width ranges
let disabledRanges = new Set();

/**
 * Updates the map filter based on currently disabled ranges
 * @param {maplibregl.Map} map - The map instance
 * @param {boolean} forceVisibility - If true, will set visibility to visible (default: false)
 */
function updateMapFilter(map, forceVisibility = false) {
  if (!map.getLayer("nettobreite")) {
    return;
  }

  // Check if main toggle is enabled
  const toggleCheckbox = document.getElementById("toggle-nettobreite");
  const isToggleEnabled = toggleCheckbox ? toggleCheckbox.checked : true;

  if (!isToggleEnabled) {
    // Don't update filter if main toggle is disabled
    return;
  }

  // If all ranges are disabled, hide the layer
  if (disabledRanges.size === Object.keys(WIDTH_RANGE_FILTERS).length) {
    map.setLayoutProperty("nettobreite", "visibility", "none");
    return;
  }

  // Ensure layer is visible (some categories are enabled)
  map.setLayoutProperty("nettobreite", "visibility", "visible");

  // Build filter: pure inclusion strategy (no exclusions)
  // Missing categories (schwarze) work independently - activated filters show all matching features
  const allRanges = Object.keys(WIDTH_RANGE_FILTERS);
  const enabledRanges = allRanges.filter(range => !disabledRanges.has(range));
  
  if (enabledRanges.length === 0) {
    // All categories disabled - hide layer
    map.setLayoutProperty("nettobreite", "visibility", "none");
    return;
  }
  
  if (enabledRanges.length === allRanges.length) {
    // All categories enabled - no filter needed
    map.setFilter("nettobreite", null);
    return;
  }
  
  // Build inclusion filters for enabled ranges (pure inclusion, no exclusions)
  const inclusionFilters = enabledRanges.map(range => {
    const filter = WIDTH_RANGE_FILTERS[range];
    if (!filter || !Array.isArray(filter)) {
      console.warn(`[FILTER] Invalid filter for range: ${range}`, filter);
      return null;
    }
    return filter;
  }).filter(filter => filter !== null); // Remove any invalid filters
  
  if (inclusionFilters.length === 0) {
    // No valid filters - hide layer
    map.setLayoutProperty("nettobreite", "visibility", "none");
    return;
  }
  
  // Combine all enabled filters with OR (pure inclusion strategy)
  const finalFilter = inclusionFilters.length === 1
    ? inclusionFilters[0]
    : ["any", ...inclusionFilters];
  
  map.setFilter("nettobreite", finalFilter);
}

/**
 * Exported function to update filter when main toggle is enabled
 */
export function refreshFilter(map) {
  updateMapFilter(map, true);
}

/**
 * Toggles a width range category
 */
function toggleWidthRange(map, rangeKey) {
  // "no-width" is not toggleable - it's always visible but not clickable
  if (rangeKey === "no-width") {
    return;
  }

  if (disabledRanges.has(rangeKey)) {
    disabledRanges.delete(rangeKey);
  } else {
    disabledRanges.add(rangeKey);
  }

  // No automatic synchronization - missing categories work independently

  // Update UI
  const categoryElement = document.querySelector(`[data-width-range="${rangeKey}"]`);
  if (categoryElement) {
    categoryElement.classList.toggle("disabled", disabledRanges.has(rangeKey));
  }

  // Update map filter
  updateMapFilter(map);
}

/**
 * Sets up click handlers for width legend categories
 */
export function setupWidthLegendInteractivity(map) {
  const categories = document.querySelectorAll(".legend-category[data-width-range]");

  categories.forEach(category => {
    const rangeKey = category.dataset.widthRange;

    category.addEventListener("click", () => {
      toggleWidthRange(map, rangeKey);
    });
  });

  // Initialize all categories as enabled
  categories.forEach(category => {
    category.classList.remove("disabled");
  });

  // Ensure initial filter is clear
  updateMapFilter(map);
}

// ============================================================================
// Width Layer Interactivity (separate from nettobreite)
// ============================================================================

// Map of width ranges for the width layer (using width_base)
const WIDTH_BASE_RANGE_FILTERS = {
  "width-1": ["all",
    ["has", "width_base"],
    ["<", ["get", "width_base"], 5]
  ],
  "width-2": ["all",
    ["has", "width_base"],
    [">=", ["get", "width_base"], 5],
    ["<", ["get", "width_base"], 7]
  ],
  "width-3": ["all",
    ["has", "width_base"],
    [">=", ["get", "width_base"], 7],
    ["<", ["get", "width_base"], 9]
  ],
  "width-4": ["all",
    ["has", "width_base"],
    [">=", ["get", "width_base"], 9],
    ["<", ["get", "width_base"], 11]
  ],
  "width-5": ["all",
    ["has", "width_base"],
    [">=", ["get", "width_base"], 11]
  ],
  "width-missing": ["!", ["has", "width_base"]]
};

// Track disabled width ranges for width layer
let disabledWidthRanges = new Set();

/**
 * Updates the width layer filter based on currently disabled ranges
 */
function updateWidthLayerFilter(map) {
  if (!map.getLayer("width")) {
    return;
  }

  // Check if main toggle is enabled
  const toggleCheckbox = document.getElementById("toggle-width");
  const isToggleEnabled = toggleCheckbox ? toggleCheckbox.checked : false;

  if (!isToggleEnabled) {
    // Don't update filter if main toggle is disabled
    return;
  }

  // If all ranges are disabled, hide the layer
  if (disabledWidthRanges.size === Object.keys(WIDTH_BASE_RANGE_FILTERS).length) {
    map.setLayoutProperty("width", "visibility", "none");
    return;
  }

  // Ensure layer is visible (some categories are enabled)
  map.setLayoutProperty("width", "visibility", "visible");

  // Build filter: pure inclusion strategy
  const allRanges = Object.keys(WIDTH_BASE_RANGE_FILTERS);
  const enabledRanges = allRanges.filter(range => !disabledWidthRanges.has(range));
  
  if (enabledRanges.length === 0) {
    // All categories disabled - hide layer
    map.setLayoutProperty("width", "visibility", "none");
    return;
  }
  
  if (enabledRanges.length === allRanges.length) {
    // All categories enabled - show all (with and without width_base)
    map.setFilter("width", null);
    return;
  }
  
  // Build inclusion filters for enabled ranges
  const inclusionFilters = enabledRanges.map(range => {
    const filter = WIDTH_BASE_RANGE_FILTERS[range];
    if (!filter || !Array.isArray(filter)) {
      console.warn(`[FILTER] Invalid filter for width range: ${range}`, filter);
      return null;
    }
    return filter;
  }).filter(filter => filter !== null);
  
  if (inclusionFilters.length === 0) {
    // No valid filters - hide layer
    map.setLayoutProperty("width", "visibility", "none");
    return;
  }
  
  // Combine all enabled filters with OR
  const finalFilter = inclusionFilters.length === 1
    ? inclusionFilters[0]
    : ["any", ...inclusionFilters];
  
  map.setFilter("width", finalFilter);
}

/**
 * Toggles a width range category for the width layer
 */
function toggleWidthRangeForWidthLayer(map, rangeKey) {
  if (!WIDTH_BASE_RANGE_FILTERS[rangeKey]) {
    return; // Not a valid width range for width layer
  }

  if (disabledWidthRanges.has(rangeKey)) {
    disabledWidthRanges.delete(rangeKey);
  } else {
    disabledWidthRanges.add(rangeKey);
  }

  // Update UI
  const categoryElement = document.querySelector(`[data-width-range="${rangeKey}"]`);
  if (categoryElement) {
    categoryElement.classList.toggle("disabled", disabledWidthRanges.has(rangeKey));
  }

  // Update map filter
  updateWidthLayerFilter(map);
}

/**
 * Sets up click handlers for width legend categories (for width layer)
 */
export function setupWidthLayerLegendInteractivity(map) {
  // Only get categories within the width section
  const widthSection = document.querySelector('.legend-section[data-section="width"]');
  if (!widthSection) {
    return;
  }

  const categories = widthSection.querySelectorAll(".legend-category[data-width-range]");

  categories.forEach(category => {
    const rangeKey = category.dataset.widthRange;
    
    // Handle all width ranges including width-missing
    if (WIDTH_BASE_RANGE_FILTERS[rangeKey]) {
      category.addEventListener("click", () => {
        toggleWidthRangeForWidthLayer(map, rangeKey);
      });
    }
  });

  // Initialize all categories as enabled
  categories.forEach(category => {
    const rangeKey = category.dataset.widthRange;
    if (WIDTH_BASE_RANGE_FILTERS[rangeKey]) {
      category.classList.remove("disabled");
    }
  });

  // Ensure initial filter is set when toggle is enabled
  const toggleCheckbox = document.getElementById("toggle-width");
  if (toggleCheckbox) {
    toggleCheckbox.addEventListener("change", () => {
      updateWidthLayerFilter(map);
    });
  }
  
  // Ensure initial filter is clear
  updateWidthLayerFilter(map);
}

