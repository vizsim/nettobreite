// permalink.js - Simple permalink functionality for coordinates and zoom

export class Permalink {
  constructor(map) {
    this.map = map;
    this.isUpdating = false;
    this.setupEventListeners();
    this.loadFromURL();
  }

  setupEventListeners() {
    // Update URL on map move/zoom (debounced)
    this.map.on('moveend', () => this.updateURL());
    this.map.on('zoomend', () => this.updateURL());
  }

  updateURL() {
    if (this.isUpdating) return;
    
    const center = this.map.getCenter();
    const zoom = this.map.getZoom();
    
    // Round coordinates for cleaner URLs
    const lng = Math.round(center.lng * 1000) / 1000;
    const lat = Math.round(center.lat * 1000) / 1000;
    const zoomRounded = Math.round(zoom * 10) / 10;
    
    // Create compact URL format: ?map={zoom}/{lat}/{lng}
    const mapParam = `${zoomRounded}/${lat}/${lng}`;
    const newURL = `${window.location.pathname}?map=${mapParam}`;
    window.history.replaceState({}, '', newURL);
  }

  loadFromURL() {
    const params = new URLSearchParams(window.location.search);
    const mapParam = params.get('map');
    
    if (mapParam) {
      // Parse compact format: {zoom}/{lat}/{lng}
      const parts = mapParam.split('/');
      if (parts.length === 3) {
        const zoom = parseFloat(parts[0]);
        const lat = parseFloat(parts[1]);
        const lng = parseFloat(parts[2]);
        
        // Only update if we have valid coordinates
        if (!isNaN(zoom) && !isNaN(lat) && !isNaN(lng)) {
          this.isUpdating = true;
          
          // Set center and zoom
          this.map.setCenter([lng, lat]);
          this.map.setZoom(zoom);
          
          // Reset flag after a short delay
          setTimeout(() => {
            this.isUpdating = false;
          }, 100);
        }
      }
    }
  }

  // Method to get current state as URL parameters
  getCurrentState() {
    const center = this.map.getCenter();
    const zoom = this.map.getZoom();
    
    return {
      lng: Math.round(center.lng * 1000) / 1000,
      lat: Math.round(center.lat * 1000) / 1000,
      zoom: Math.round(zoom * 10) / 10
    };
  }

  // Method to generate shareable URL
  getShareableURL() {
    const state = this.getCurrentState();
    const mapParam = `${state.zoom}/${state.lat}/${state.lng}`;
    
    return `${window.location.origin}${window.location.pathname}?map=${mapParam}`;
  }
}

// Export a simple setup function
export function setupPermalink(map) {
  return new Permalink(map);
}
