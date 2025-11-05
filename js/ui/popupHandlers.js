
// popupHandlers.js

export function setupNettobreitePopups(map) {
    const popup = new maplibregl.Popup({ closeButton: false, closeOnClick: false });
    let clickedFeature = null; // Track clicked feature to keep popup visible

    const renderNettobreiteTooltip = (props) => {
        const id = props["osm:id"]	 || 'N/A';
        const width = props.width ? parseFloat(props.width).toFixed(1) + ' m' : 'N/A';
        const widthBase = props.width_base ? parseFloat(props.width_base).toFixed(1) + ' m' : 'N/A';
        const widthEffective = props.width_effective ? parseFloat(props.width_effective).toFixed(1) + ' m' : 'N/A';
        const highway = props.highway || 'N/A';
        const oneway = props.oneway || 'no';
        
        // Missing flags
        const cyclewayMissing = props.cycleway_missing === true || props.cycleway_missing === 'true' || props.cycleway_missing === 1 ? 'Ja' : 'Nein';
        const parkingMissing = props.parking_missing === true || props.parking_missing === 'true' || props.parking_missing === 1 ? 'Ja' : 'Nein';
        const widthsMissing = props.widths_missing === true || props.widths_missing === 'true' || props.widths_missing === 1 ? 'Ja' : 'Nein';
        
        // Handle cycleway - use cycleway:both as fallback for left/right
        const cyclewayBoth = props['cycleway:both'];
        const cyclewayLeft = props['cycleway:left'] || cyclewayBoth || 'N/A';
        const cyclewayRight = props['cycleway:right'] || cyclewayBoth || 'N/A';
        const cyclewayBothDisplay = cyclewayBoth || 'N/A';
        
        // Handle parking:both - if it exists, use it for both left and right
        const parkingBoth = props['parking:both'];
        const parkingLeft = props['parking:left'] || parkingBoth || 'N/A';
        const parkingRight = props['parking:right'] || parkingBoth || 'N/A';
        
        // Handle parking orientation - use parking:both:orientation and parking:orientation as fallback for both sides
        const parkingOrientation = props['parking:orientation'];
        const parkingBothOrientation = props['parking:both:orientation'];
        const parkingLeftOrientation = props['parking:left:orientation'] || parkingBothOrientation || parkingOrientation || 'N/A';
        const parkingRightOrientation = props['parking:right:orientation'] || parkingBothOrientation || parkingOrientation || 'N/A';
        
        const parkingLeftOnlane = props.parking_left_onlane_m ? parseFloat(props.parking_left_onlane_m).toFixed(1) + ' m' : '0 m';
        const parkingRightOnlane = props.parking_right_onlane_m ? parseFloat(props.parking_right_onlane_m).toFixed(1) + ' m' : '0 m';
        const cyclewayLeftOnlane = props.cycleway_left_onlane_m ? parseFloat(props.cycleway_left_onlane_m).toFixed(1) + ' m' : '0 m';
        const cyclewayRightOnlane = props.cycleway_right_onlane_m ? parseFloat(props.cycleway_right_onlane_m).toFixed(1) + ' m' : '0 m';

        return `
    <div style="font-size: 12px; max-width: 300px;">
        <!-- Breiteninformationen -->
        <div style="margin-bottom: 12px;">
            <div style="font-weight: bold; color: #2c3e50; margin-bottom: 6px; font-size: 13px;">
                📏 Breiteninformationen
            </div>
            <table style="border-collapse: collapse; width: 100%; font-size: 11px;">
                <tr><td style="padding: 2px 0;"><strong>Breite (explizit)</strong></td><td style="padding: 2px 0; text-align: right;">${width}</td></tr>
                <tr><td style="padding: 2px 0;"><strong>Breite (Basis)</strong></td><td style="padding: 2px 0; text-align: right;">${widthBase}</td></tr>
                <tr><td style="padding: 2px 0;"><strong>Breite (effektiv)</strong></td><td style="padding: 2px 0; text-align: right;">${widthEffective}</td></tr>
            </table>
        </div>

        <!-- Parkplatzinformationen -->
        <div style="margin-bottom: 12px;">
            <div style="font-weight: bold; color: #2c3e50; margin-bottom: 6px; font-size: 13px;">
                🅿️ Parkplatzinformationen
            </div>
            <table style="border-collapse: collapse; width: 100%; font-size: 11px;">
                <tr><td style="padding: 2px 0;"><strong>Parken links</strong></td><td style="padding: 2px 0; text-align: right;">${parkingLeft}</td></tr>
                <tr><td style="padding: 2px 0;"><strong>Parken rechts</strong></td><td style="padding: 2px 0; text-align: right;">${parkingRight}</td></tr>
                <tr><td style="padding: 2px 0;"><strong>Orientierung links</strong></td><td style="padding: 2px 0; text-align: right;">${parkingLeftOrientation}</td></tr>
                <tr><td style="padding: 2px 0;"><strong>Orientierung rechts</strong></td><td style="padding: 2px 0; text-align: right;">${parkingRightOrientation}</td></tr>
                <tr><td style="padding: 2px 0;"><strong>Parkplatz links (Spur)</strong></td><td style="padding: 2px 0; text-align: right;">${parkingLeftOnlane}</td></tr>
                <tr><td style="padding: 2px 0;"><strong>Parkplatz rechts (Spur)</strong></td><td style="padding: 2px 0; text-align: right;">${parkingRightOnlane}</td></tr>
            </table>
        </div>

        <!-- Radweginformationen -->
        <div style="margin-bottom: 12px;">
            <div style="font-weight: bold; color: #2c3e50; margin-bottom: 6px; font-size: 13px;">
                🚴 Radweginformationen
            </div>
            <table style="border-collapse: collapse; width: 100%; font-size: 11px;">
                <tr><td style="padding: 2px 0;"><strong>Radweg links</strong></td><td style="padding: 2px 0; text-align: right;">${cyclewayLeft}</td></tr>
                <tr><td style="padding: 2px 0;"><strong>Radweg rechts</strong></td><td style="padding: 2px 0; text-align: right;">${cyclewayRight}</td></tr>
                <tr><td style="padding: 2px 0;"><strong>Radweg links (Spur)</strong></td><td style="padding: 2px 0; text-align: right;">${cyclewayLeftOnlane}</td></tr>
                <tr><td style="padding: 2px 0;"><strong>Radweg rechts (Spur)</strong></td><td style="padding: 2px 0; text-align: right;">${cyclewayRightOnlane}</td></tr>
            </table>
        </div>

        <!-- Straßeninformationen -->
        <div style="margin-bottom: 12px;">
            <div style="font-weight: bold; color: #2c3e50; margin-bottom: 6px; font-size: 13px;">
                🛣️ Straßeninformationen
            </div>
            <table style="border-collapse: collapse; width: 100%; font-size: 11px;">
                <tr><td style="padding: 2px 0;"><strong>Highway</strong></td><td style="padding: 2px 0; text-align: right;">${highway}</td></tr>
                <tr><td style="padding: 2px 0;"><strong>Einbahnstraße</strong></td><td style="padding: 2px 0; text-align: right;">${oneway}</td></tr>
                <tr><td style="padding: 2px 0;"><strong>OSM ID</strong></td><td style="padding: 2px 0; text-align: right;">${id !== 'N/A' ? `<a href="https://www.openstreetmap.org/way/${id}" target="_blank" style="color: #0066cc; text-decoration: none;">${id}</a>` : id}</td></tr>
                <tr><td style="padding: 2px 0;"><strong>Cycleway fehlt</strong></td><td style="padding: 2px 0; text-align: right;">${cyclewayMissing}</td></tr>
                <tr><td style="padding: 2px 0;"><strong>Parking fehlt</strong></td><td style="padding: 2px 0; text-align: right;">${parkingMissing}</td></tr>
                <tr><td style="padding: 2px 0;"><strong>Widths fehlt</strong></td><td style="padding: 2px 0; text-align: right;">${widthsMissing}</td></tr>
            </table>
        </div>
    </div>
  `;
    };

    map.on("mousemove", "nettobreite", (e) => {
        if (window.popupsEnabled && !window.popupsEnabled()) return;
        // Only show popup on hover if no feature is clicked
        if (!clickedFeature) {
            const html = renderNettobreiteTooltip(e.features[0].properties);
            popup.setLngLat(e.lngLat).setHTML(html).addTo(map);
            map.getCanvas().style.cursor = "pointer";
        }
    });

    map.on("mouseleave", "nettobreite", () => {
        // Only remove popup on mouseleave if no feature is clicked
        if (!clickedFeature) {
            popup.remove();
            map.getCanvas().style.cursor = "";
        }
    });

    // Click to "pin" the popup
    map.on("click", "nettobreite", (e) => {
        if (window.popupsEnabled && !window.popupsEnabled()) return;
        
        const clickedProps = e.features[0].properties;
        const clickedId = clickedProps.id || JSON.stringify(clickedProps);
        
        // If clicking the same feature, unpin it
        if (clickedFeature && clickedFeature.id === clickedId) {
            clickedFeature = null;
            popup.remove();
        } else {
            // Pin the new feature
            clickedFeature = { id: clickedId, props: clickedProps, lngLat: e.lngLat };
            const html = renderNettobreiteTooltip(clickedProps);
            popup.setLngLat(e.lngLat).setHTML(html).addTo(map);
        }
    });

    // Click elsewhere on the map to unpin
    map.on("click", (e) => {
        // Check if click was on nettobreite layer
        const features = map.queryRenderedFeatures(e.point, { layers: ["nettobreite"] });
        if (features.length === 0 && clickedFeature) {
            // Clicked outside nettobreite layer, unpin
            clickedFeature = null;
            popup.remove();
        }
    });
}

export function setupWidthPopups(map) {
    const popup = new maplibregl.Popup({ closeButton: false, closeOnClick: false });
    let clickedFeature = null;

    const renderWidthTooltip = (props) => {
        const widthBase = props.width_base ? parseFloat(props.width_base).toFixed(1) + ' m' : 'N/A';
        return `<div style="font-size: 12px;">Breite: ${widthBase}</div>`;
    };

    map.on("mousemove", "width", (e) => {
        if (window.popupsEnabled && !window.popupsEnabled()) return;
        if (!clickedFeature) {
            const html = renderWidthTooltip(e.features[0].properties);
            popup.setLngLat(e.lngLat).setHTML(html).addTo(map);
            map.getCanvas().style.cursor = "pointer";
        }
    });

    map.on("mouseleave", "width", () => {
        if (!clickedFeature) {
            popup.remove();
            map.getCanvas().style.cursor = "";
        }
    });

    // Click to "pin" the popup
    map.on("click", "width", (e) => {
        if (window.popupsEnabled && !window.popupsEnabled()) return;
        
        const clickedProps = e.features[0].properties;
        const clickedId = clickedProps.id || JSON.stringify(clickedProps);
        
        if (clickedFeature && clickedFeature.id === clickedId) {
            clickedFeature = null;
            popup.remove();
        } else {
            clickedFeature = { id: clickedId, props: clickedProps, lngLat: e.lngLat };
            const html = renderWidthTooltip(clickedProps);
            popup.setLngLat(e.lngLat).setHTML(html).addTo(map);
        }
    });

    // Click elsewhere on the map to unpin
    map.on("click", (e) => {
        const features = map.queryRenderedFeatures(e.point, { layers: ["width"] });
        if (features.length === 0 && clickedFeature) {
            clickedFeature = null;
            popup.remove();
        }
    });
}

