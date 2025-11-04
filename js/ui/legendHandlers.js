// legendHandlers.js



const LEGEND_KEYS = [
  // "cluster-legend-section",
  // "movebis-legend",
  // "hvs-legend",
  "mapillary-legend",
  //  "agrar_1-legend",
];

function getLegendElements() {
  const elements = Object.fromEntries(
    LEGEND_KEYS.map(id => [id, document.getElementById(id)])
  );
  elements.scenarioSections = Array.from(document.querySelectorAll(".scenario-legend-section"));
  return elements;
}


export function applyLegendVisibility() {
  const keys = [
    // "schools", "health", "playgrounds",
    // "hvs", 
    "mapillary", 
    // "agrar_1"
  ];

  keys.forEach(key => {
    const toggle = document.getElementById(`toggle-${key}`);
    const legend = document.getElementById(`${key}-legend`);
    if (toggle && legend) {
      legend.style.display = toggle.checked ? "block" : "none";
    }
  });
}




export function updateScenarioLegendVisibility() {
  const legendBox = document.querySelector(".legend");
  const isCollapsed = legendBox.classList.contains("collapsed");

  document.querySelectorAll(".scenario-legend-section").forEach(section => {
    section.style.display = isCollapsed ? "none" : "block";
  });
}






export function setupLegendToggleHandlers() {
  const legends = getLegendElements();

  document.querySelectorAll(".legend-header, .legend-section-allcontent").forEach(header => {
    header.addEventListener("click", (e) => {
      if (e.target.tagName === "INPUT" || e.target.classList.contains("info-icon")) return;

      const key = header.dataset.toggle;
      const arrow = header.querySelector(`.toggle-arrow[data-arrow="${key}"]`);

      if (key === "legend-root") {
        console.log("Toggling legend-root");
        const legend = document.querySelector(".legend");
        const collapsed = legend.classList.toggle("collapsed");
        const zoom = window.map.getZoom();

        Array.from(legend.children).forEach(el => {
          const isTitle = el.classList.contains("legend-title");
          const isFeatureCount = el.id === "feature-count-wrapper";


          if (collapsed) {
            el.style.display = isTitle || isFeatureCount ? "" : "none";
          } else {
el.style.display = "";
          }
        });

        if (!collapsed) {
          // updateLegendVisibilityByZoom(window.map);
          updateScenarioLegendVisibility();
        }
      } else {
        // const section = document.querySelector(`.legend-items[data-section="${key}"]`);
        const section =
          document.querySelector(`.legend-section-allcontent[data-section="${key}"]`) ||
          document.querySelector(`.legend-items[data-section="${key}"]`);
        if (section) section.classList.toggle("collapsed");
      }

      if (arrow) arrow.classList.toggle("open");
    });
  });
}



