// widthLegendInteractivity.js
// Handles interactive legend for width categories

// Map of width ranges to their filter conditions
const WIDTH_RANGE_FILTERS = {
  "not-plausible": ["all",
    ["has", "width_effective"],
    [">=", ["get", "width_effective"], 0],
    ["<", ["get", "width_effective"], 1]
  ],
  "very-narrow": ["all",
    ["has", "width_effective"],
    [">=", ["get", "width_effective"], 1],
    ["<", ["get", "width_effective"], 3]
  ],
  "narrow-3-4": ["all", 
    [">=", ["get", "width_effective"], 3],
    ["<", ["get", "width_effective"], 4]
  ],
  "narrow-4-45": ["all",
    [">=", ["get", "width_effective"], 4],
    ["<", ["get", "width_effective"], 4.5]
  ],
  "narrow-45-5": ["all",
    [">=", ["get", "width_effective"], 4.5],
    ["<", ["get", "width_effective"], 5]
  ],
  "restricted-5-55": ["all",
    [">=", ["get", "width_effective"], 5],
    ["<", ["get", "width_effective"], 5.5]
  ],
  "sufficient-55-6": ["all",
    [">=", ["get", "width_effective"], 5.5],
    ["<", ["get", "width_effective"], 6]
  ],
  "wide-6-7": ["all",
    [">=", ["get", "width_effective"], 6],
    ["<", ["get", "width_effective"], 7]
  ],
  "very-wide-7-8": ["all",
    [">=", ["get", "width_effective"], 7],
    ["<", ["get", "width_effective"], 8]
  ],
  "very-wide-8plus": [">=", ["get", "width_effective"], 8],
  "no-width": ["any",
    ["==", ["get", "width_effective"], null],
    ["!", ["has", "width_effective"]]
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

  // Ensure layer is visible if forceVisibility is true or if we're updating filters
  if (forceVisibility) {
    map.setLayoutProperty("nettobreite", "visibility", "visible");
  }

  // Build filter: show all features EXCEPT those in disabled ranges
  // Special handling: "no-width" (schwarz) always stays visible unless explicitly disabled
  const isNoWidthDisabled = disabledRanges.has("no-width");
  
  if (disabledRanges.size === 0) {
    // No filter needed - show everything
    map.setFilter("nettobreite", null);
  } else {
    // Separate "no-width" from other disabled ranges
    const disabledRangesWithoutNoWidth = Array.from(disabledRanges).filter(range => range !== "no-width");
    
    if (disabledRangesWithoutNoWidth.length === 0) {
      // Only "no-width" is disabled, show everything else
      const noWidthFilter = WIDTH_RANGE_FILTERS["no-width"];
      map.setFilter("nettobreite", ["!", noWidthFilter]);
    } else {
      // Build exclusion filters for non-no-width ranges
      const exclusionFilters = disabledRangesWithoutNoWidth.map(range => {
        const filter = WIDTH_RANGE_FILTERS[range];
        return ["!", filter];
      });

      // If "no-width" is not disabled, always include it (show no-width OR show filtered ranges)
      if (!isNoWidthDisabled) {
        const noWidthFilter = WIDTH_RANGE_FILTERS["no-width"];
        // Show: no-width OR (not disabled ranges)
        const showEnabledRanges = exclusionFilters.length === 1 
          ? exclusionFilters[0]
          : ["all", ...exclusionFilters];
        
        map.setFilter("nettobreite", ["any", noWidthFilter, showEnabledRanges]);
      } else {
        // "no-width" is also disabled, just exclude all disabled ranges
        if (exclusionFilters.length === 1) {
          map.setFilter("nettobreite", exclusionFilters[0]);
        } else {
          map.setFilter("nettobreite", ["all", ...exclusionFilters]);
        }
      }
    }
  }
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
  if (disabledRanges.has(rangeKey)) {
    disabledRanges.delete(rangeKey);
  } else {
    disabledRanges.add(rangeKey);
  }

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

