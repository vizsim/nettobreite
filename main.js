// 📦 Kartenfunktionen
import { addSources } from "./js/mapdata/addSources.js";
import { addLayers } from "./js/mapdata/addLayers.js";

// 📦 UI & Interaktion
import { setupBaseLayerControls } from './js/ui/setupBaseLayerControls.js';
import { setupLayerToggles } from './js/ui/setupLayerToggles.js';

// 📦 Legende
import {
  applyLegendVisibility,
  setupLegendToggleHandlers,
} from './js/ui/legendHandlers.js';

// 📦 Geocoder
import { setupPhotonGeocoder } from './js/utils/geocoder.js';

// 📦 Popups
import { setupNettobreitePopups } from './js/ui/popupHandlers.js';

// 📦 Width Legend Interactivity
import { setupWidthLegendInteractivity, refreshFilter } from './js/ui/widthLegendInteractivity.js';

// 📦 Mapillary
import { setupMapillary } from './js/utils/useMapillary.js';

// 📦 Permalink
import { setupPermalink } from './js/utils/permalink.js';

let MAPTILER_API_KEY = '';
let MAPILLARY_TOKEN = '';

let originalMinZoom = 9;
let originalMaxZoom = 20;

let currentZoomLock = null;

const isInitializingRef = { value: true };

const isLocalhost = location.hostname === "localhost";

// Setup popup toggle (global state for popup handlers)
window.popupsEnabled = () => true; // Always enabled for now

document.querySelector('[data-map="standard"]').style.backgroundImage =
  "url('./thumbs/thumb-standard.png')";

document.querySelector('[data-map="satellite"]').style.backgroundImage =
  "url('./thumbs/thumb-satellite.png')";

(async () => {
  try {
    const config = await import(isLocalhost ? './js/config/config.js' : './js/config/config.public.js');
    ({ MAPTILER_API_KEY, MAPILLARY_TOKEN } = config);
    console.log(`🔑 ${isLocalhost ? "Lokale config.js" : "config.public.js"} geladen`);

    initMap();

  } catch (err) {
    console.error("❌ Konfig konnte nicht geladen werden:", err);
  }
})();

async function initMap() {
  // Load pmtiles protocol
  const pmtilesBaseURL = "https://f003.backblazeb2.com/file/nettobreite/";
  const protocol = new pmtiles.Protocol(name => `${pmtilesBaseURL}${name}`);
  maplibregl.addProtocol("pmtiles", protocol.tile);

  window.map = new maplibregl.Map({
    container: "map",
    style: "./style.json",
    center: [13.42113, 52.47676], // Default center
    zoom: 12,                  // Default zoom
    minZoom: 9,
    maxZoom: 20
  });

  // Setup permalink functionality (reads URL params and updates URL on map move)
  setupPermalink(map);

  map.on("load", () => {
    initializeMapModules(map);
    setupUI(map);
    setupLegend(map);
    setupNettobreiteToggle(map);
    setupNettobreitePopups(map);
    setupWidthLegendInteractivity(map);
    setupMapillary(map, {
      originalMinZoom,
      setCurrentZoomLock: z => currentZoomLock = z,
      applyLegendVisibility
    });
    setupEventHandlers(map);
  });
}

function addNavigationControl(map) {
  const nav = new maplibregl.NavigationControl();

  const customNavContainer = document.getElementById("custom-nav-control");
  customNavContainer.appendChild(nav.onAdd(map));

  // Kompass-Reset aktivieren
  setTimeout(() => {
    const compass = customNavContainer.querySelector('.maplibregl-ctrl-compass');
    if (compass) {
      compass.addEventListener('click', () => {
        map.setPitch(0);
        map.easeTo({ bearing: 0 });
      });
    }
  }, 100);
}

function setupLegend(map) {
  setupLegendToggleHandlers();
  
  // Initialize zoom level display
  const zoom = map.getZoom();
  const zoomLockText = currentZoomLock
    ? `<span class="zoom-lock">🔒 ${currentZoomLock}</span>`
    : "";
  const zoomText = `Zoomlevel: ${zoom.toFixed(2)}${zoomLockText ? ` [${zoomLockText}]` : ""}`;
  
  const featureCountElement = document.getElementById("feature-count");
  if (featureCountElement) {
    featureCountElement.innerHTML = `<div>${zoomText}</div>`;
  }
}

function setupUI(map) {
  setupBaseLayerControls(map, isInitializingRef);
  setupLayerToggles(
    map,
    originalMinZoom,
    z => currentZoomLock = z,
    applyLegendVisibility
  );

  // Cache section arrows to avoid repeated DOM queries
  const sectionArrows = document.querySelectorAll('.section-arrow');
  sectionArrows.forEach(arrow => {
    arrow.addEventListener('click', () => {
      const section = document.querySelector(`.legend-section[data-section="${arrow.dataset.arrow}"]`);
      if (!section) return;
      const isOpen = arrow.classList.contains('open');
      arrow.classList.toggle('open', !isOpen);
      section.classList.toggle('collapsed', isOpen);
    });
  });
}

function setupNettobreiteToggle(map) {
  const toggleCheckbox = document.getElementById("toggle-nettobreite");

  // Initial state
  map.setLayoutProperty("nettobreite", "visibility", "visible");

  if (toggleCheckbox) {
    toggleCheckbox.addEventListener("change", () => {
      const isVisible = toggleCheckbox.checked;
      if (isVisible) {
        // Re-apply filters when enabling the layer
        refreshFilter(map);
      } else {
        map.setLayoutProperty("nettobreite", "visibility", "none");
      }
    });
  }
}

function setupEventHandlers(map) {
  // Update zoom level display
  map.on("zoomend", () => {
    const zoom = map.getZoom();
    const zoomLockText = currentZoomLock
      ? `<span class="zoom-lock">🔒 ${currentZoomLock}</span>`
      : "";
    const zoomText = `Zoomlevel: ${zoom.toFixed(2)}${zoomLockText ? ` [${zoomLockText}]` : ""}`;
    
    const featureCountElement = document.getElementById("feature-count");
    if (featureCountElement) {
      featureCountElement.innerHTML = `<div>${zoomText}</div>`;
    }
  });

  applyLegendVisibility();
}

function initializeMapModules(map) {
  setupPhotonGeocoder(map);
  addNavigationControl(map);
  addSources(map, { MAPILLARY_TOKEN, MAPTILER_API_KEY });
  addLayers(map);
}

// Toggle logic for Hillshade and Terrain
document.getElementById('toggleHillshade').addEventListener('change', (e) => {
  const visibility = e.target.checked ? 'visible' : 'none';
  map.setLayoutProperty('hillshade-layer', 'visibility', visibility);
});

document.getElementById('toggleTerrain').addEventListener('change', (e) => {
  if (e.target.checked) {
    map.setTerrain({ source: 'terrain', exaggeration: 1.5 });
  } else {
    map.setTerrain(null);
  }
});
