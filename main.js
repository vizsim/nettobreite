// 📦 Kartenfunktionen
import { addSources } from "./js/mapdata/addSources.js";
import { addLayers } from "./js/mapdata/addLayers.js";

// 📦 UI & Interaktion
import { setupLayerToggles } from './js/ui/setupLayerToggles.js';

// 📦 Basemap/Terrain (keyless) + Datenstand
import { addBasemapTerrain, setBasemap, setRelief, setBuildings } from './js/map/basemapTerrain.js';
import { applyDataVintages } from './js/utils/applyDataVintages.js';

// 📦 Legende
import {
  applyLegendVisibility,
  setupLegendToggleHandlers,
} from './js/ui/legendHandlers.js';

// 📦 Geocoder
import { setupPhotonGeocoder } from './js/utils/geocoder.js';

// 📦 Popups
import { setupNettobreitePopups, setupWidthPopups } from './js/ui/popupHandlers.js';

// 📦 Width Legend Interactivity
import { setupWidthLegendInteractivity, refreshFilter, setupWidthLayerLegendInteractivity } from './js/ui/widthLegendInteractivity.js';

// 📦 Mapillary
import { setupMapillary } from './js/utils/useMapillary.js';

// 📦 Permalink
import { setupPermalink } from './js/utils/permalink.js';

let MAPILLARY_TOKEN = '';

let originalMinZoom = 9;
let originalMaxZoom = 20;

let currentZoomLock = null;

const isLocalhost = location.hostname === "localhost";

// Setup popup toggle (global state for popup handlers)
window.popupsEnabled = () => true; // Always enabled for now

(async () => {
  try {
    const config = await import(isLocalhost ? './js/config/config.js' : './js/config/config.public.js');
    ({ MAPILLARY_TOKEN } = config);
    console.log(`🔑 ${isLocalhost ? "Lokale config.js" : "config.public.js"} geladen`);

    initMap();

  } catch (err) {
    console.error("❌ Konfig konnte nicht geladen werden:", err);
  }
})();

async function initMap() {
  // Load pmtiles protocol
  const pmtilesBaseURL = "https://tiles.vizsim.de/file/nettobreite/";
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
    setupWidthToggle(map);
    setupNettobreitePopups(map);
    setupWidthPopups(map);
    setupWidthLegendInteractivity(map);
    setupWidthLayerLegendInteractivity(map);
    setupMapillary(map, {
      originalMinZoom,
      setCurrentZoomLock: z => currentZoomLock = z,
      applyLegendVisibility
    });
    setupEventHandlers(map);
    setupMapPanel(map);
    applyDataVintages();
  });
}

// Karten-Panel unten links: Basemap-Umschalter + Relief/3D-Toggles (keyless).
function setupMapPanel(map) {
  const panel = document.getElementById('map-settings-panel');
  const panelToggle = document.getElementById('map-settings-toggle');
  if (panelToggle && panel) {
    panelToggle.addEventListener('click', () => {
      const collapsed = panel.classList.toggle('is-collapsed');
      panelToggle.setAttribute('aria-expanded', String(!collapsed));
    });
  }

  document.querySelectorAll('.basemap-btn[data-basemap]').forEach((btn) => {
    btn.addEventListener('click', () => {
      setBasemap(map, btn.dataset.basemap);
      document.querySelectorAll('.basemap-btn').forEach((b) => b.classList.remove('selected'));
      btn.classList.add('selected');
    });
  });

  const reliefToggle = document.getElementById('toggle-relief');
  if (reliefToggle) reliefToggle.addEventListener('change', (e) => setRelief(map, e.target.checked));

  const buildingsToggle = document.getElementById('toggle-buildings');
  if (buildingsToggle) buildingsToggle.addEventListener('change', (e) => setBuildings(map, e.target.checked));
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

function setupWidthToggle(map) {
  const toggleCheckbox = document.getElementById("toggle-width");

  // Initial state - layer is hidden by default
  if (map.getLayer("width")) {
    map.setLayoutProperty("width", "visibility", "none");
  }

  if (toggleCheckbox) {
    toggleCheckbox.addEventListener("change", () => {
      const isVisible = toggleCheckbox.checked;
      if (map.getLayer("width")) {
        map.setLayoutProperty("width", "visibility", isVisible ? "visible" : "none");
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
  addSources(map, { MAPILLARY_TOKEN });
  addLayers(map);
  // Basemap-Umschalter + Mapterhorn-Relief/3D NACH addSources/addLayers (Symbol-
  // Reihenfolge steht dann); ersetzt die alten MapTiler-Terrain/Hillshade-Handler.
  addBasemapTerrain(map);
}
