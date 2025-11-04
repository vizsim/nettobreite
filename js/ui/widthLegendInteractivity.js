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
  "no-width": ["any",
    // Fehlende width_effective
    ["==", ["get", "width_effective"], null],
    ["!", ["has", "width_effective"]],
    // Missing flags (werden als schwarz dargestellt) - unterstützt verschiedene Datentypen
    ["any",
      ["==", ["get", "cycleway_missing"], true],
      ["==", ["get", "cycleway_missing"], "true"],
      ["==", ["get", "cycleway_missing"], 1]
    ],
    ["any",
      ["==", ["get", "parking_missing"], true],
      ["==", ["get", "parking_missing"], "true"],
      ["==", ["get", "parking_missing"], 1]
    ],
    ["any",
      ["==", ["get", "widths_missing"], true],
      ["==", ["get", "widths_missing"], "true"],
      ["==", ["get", "widths_missing"], 1]
    ]
  ],
  "no-width-effective": ["any",
    ["==", ["get", "width_effective"], null],
    ["!", ["has", "width_effective"]]
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

  // Ensure layer is visible if forceVisibility is true or if we're updating filters
  if (forceVisibility) {
    map.setLayoutProperty("nettobreite", "visibility", "visible");
  }

  // Build filter: show only enabled categories (inclusion strategy)
  // This allows filtering to show only specific categories
  const allRanges = Object.keys(WIDTH_RANGE_FILTERS);
  const enabledRanges = allRanges.filter(range => !disabledRanges.has(range));
  
  // Check which specific missing categories are disabled
  // If "no-width" is disabled, also treat all missing subcategories as disabled
  const isNoWidthDisabled = disabledRanges.has("no-width");
  const disabledMissingCategories = ["cycleway-missing", "parking-missing", "widths-missing"].filter(
    cat => disabledRanges.has(cat) || isNoWidthDisabled
  );
  
  if (enabledRanges.length === 0) {
    // All categories disabled - hide layer
    map.setLayoutProperty("nettobreite", "visibility", "none");
    return;
  }
  
  if (enabledRanges.length === allRanges.length) {
    // All categories enabled - no filter needed
    map.setFilter("nettobreite", null);
  } else {
    // Build inclusion filters for enabled ranges
    let inclusionFilters = enabledRanges.map(range => {
      const filter = WIDTH_RANGE_FILTERS[range];
      // Ensure filter is properly wrapped if it's not already an array
      return Array.isArray(filter) ? filter : filter;
    });
    
    // Build exclusion filters for disabled missing categories
    // These must always be excluded, even if "no-width" is enabled
    // We need to exclude ALL features that have these flags set, regardless of other conditions
    const exclusionFilters = [];
    
    // If "no-width" is disabled, also exclude features without width_effective
    if (isNoWidthDisabled) {
      // Exclude features without width_effective
      exclusionFilters.push(["!", ["any",
        ["==", ["get", "width_effective"], null],
        ["!", ["has", "width_effective"]]
      ]]);
    }
    
    for (const cat of disabledMissingCategories) {
      // Create a direct exclusion filter for each missing flag
      // This ensures ALL features with this flag are excluded, regardless of other properties
      if (cat === "cycleway-missing") {
        // Exclude features where cycleway_missing is true (any format: true, "true", or 1)
        exclusionFilters.push(["!", ["any",
          ["==", ["get", "cycleway_missing"], true],
          ["==", ["get", "cycleway_missing"], "true"],
          ["==", ["get", "cycleway_missing"], 1]
        ]]);
      } else if (cat === "parking-missing") {
        // Exclude features where parking_missing is true (any format: true, "true", or 1)
        exclusionFilters.push(["!", ["any",
          ["==", ["get", "parking_missing"], true],
          ["==", ["get", "parking_missing"], "true"],
          ["==", ["get", "parking_missing"], 1]
        ]]);
      } else if (cat === "widths-missing") {
        // Exclude features where widths_missing is true (any format: true, "true", or 1)
        exclusionFilters.push(["!", ["any",
          ["==", ["get", "widths_missing"], true],
          ["==", ["get", "widths_missing"], "true"],
          ["==", ["get", "widths_missing"], 1]
        ]]);
      }
    }
    
    // Show features that match any of the enabled ranges, but exclude disabled missing categories
    let finalFilter;
    
    if (inclusionFilters.length === 1) {
      finalFilter = inclusionFilters[0];
    } else {
      // Combine all enabled filters with "any" to show features matching any enabled category
      finalFilter = ["any", ...inclusionFilters];
    }
    
    // Always exclude disabled missing categories
    if (exclusionFilters.length > 0) {
      if (exclusionFilters.length === 1) {
        finalFilter = ["all", finalFilter, exclusionFilters[0]];
      } else {
        finalFilter = ["all", finalFilter, ...exclusionFilters];
      }
    }
    
    map.setFilter("nettobreite", finalFilter);
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

  // If "no-width" is toggled, also toggle subcategories
  const subcategories = ["cycleway-missing", "parking-missing", "widths-missing"];
  
  if (rangeKey === "no-width") {
    // When "no-width" is disabled, also disable subcategories
    // When "no-width" is enabled, also enable subcategories
    const isNoWidthDisabled = disabledRanges.has("no-width");
    
    subcategories.forEach(subCat => {
      if (isNoWidthDisabled) {
        disabledRanges.add(subCat);
      } else {
        disabledRanges.delete(subCat);
      }
      
      // Update UI for subcategory
      const subCategoryElement = document.querySelector(`[data-width-range="${subCat}"]`);
      if (subCategoryElement) {
        subCategoryElement.classList.toggle("disabled", isNoWidthDisabled);
      }
    });
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

