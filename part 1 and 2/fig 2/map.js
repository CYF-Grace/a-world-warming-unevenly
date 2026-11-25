
// ==========================================
// CONFIGURATION
// ==========================================

const width = 1100;
const height = 600;
const YEAR = 2024;
const SOURCES_PER_SECTOR = 150;

const WORLD_URL =
  "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json";

const API_URL =
  "https://api.climatetrace.org/v7/sources";

// ==========================================
// SVG AND MAP SETUP
// ==========================================

const svg = d3.select("#map")
  .append("svg")
  .attr("viewBox", `0 0 ${width} ${height}`);

const projection = d3.geoNaturalEarth1()
  .fitExtent(
    [[20, 20], [width - 20, height - 20]],
    { type: "Sphere" }
  );

const geoPath = d3.geoPath(projection);

// Keep dots inside the globe
svg.append("defs")
  .append("clipPath")
  .attr("id", "globe-clip")
  .append("path")
  .attr("d", geoPath({ type: "Sphere" }));

// Draw ocean background
svg.append("path")
  .datum({ type: "Sphere" })
  .attr("d", geoPath)
  .attr("fill", "#deedf7")
  .attr("stroke", "#9eb5ca");

const countryLayer = svg.append("g");

const particleLayer = svg.append("g")
  .attr("clip-path", "url(#globe-clip)");

const sourceLayer = svg.append("g")
  .attr("clip-path", "url(#globe-clip)");

const tooltip = d3.select(".tooltip");
const statusText = d3.select("#status");

// ==========================================
// GLOBAL STATE
// ==========================================

let allSources = [];
let particles = [];
let isPlaying = true;

let animationTime = 0;
let lastElapsed = 0;

// ==========================================
// DATA LOADING
// ==========================================

async function fetchSources(sector) {
  const url = new URL(API_URL);

  url.searchParams.set("year", YEAR);
  url.searchParams.set("gas", "co2");
  url.searchParams.set("sectors", sector);
  url.searchParams.set("limit", SOURCES_PER_SECTOR);
  url.searchParams.set("offset", 0);

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(
      `Climate TRACE API returned ${response.status}`
    );
  }

  const rawData = await response.json();

  if (!Array.isArray(rawData)) {
    throw new Error("Unexpected API response format");
  }

  return rawData
    .map(d => ({
      id: `${sector}-${d.id}`,
      name: d.name || "Unnamed source",
      country: d.country || "Unknown",
      sector: d.sector || sector,
      emissions: Number(d.emissionsQuantity),
      longitude: Number(d.centroid?.longitude),
      latitude: Number(d.centroid?.latitude),
      capacity: d.capacity,
      capacityUnits: d.capacityUnits
    }))
    .filter(d =>
      Number.isFinite(d.emissions) &&
      d.emissions > 0 &&
      Number.isFinite(d.longitude) &&
      Number.isFinite(d.latitude) &&
      Math.abs(d.longitude) <= 180 &&
      Math.abs(d.latitude) <= 90
    );
}

// ==========================================
// VISUAL SCALES
// ==========================================

const radiusScale = d3.scaleSqrt()
  .range([2, 6]);

const colorScale = d3.scaleSequentialLog(
  d3.interpolateYlOrRd
);

// ==========================================
// TOOLTIP
// ==========================================

const formatNumber = d3.format(",.0f");

function showTooltip(event, d) {
  tooltip
    .style("display", "block")
    .html(`
      <strong>${escapeHTML(d.name)}</strong>
      <div>Country: ${escapeHTML(d.country)}</div>
      <div>Sector: ${escapeHTML(d.sector)}</div>
      <div>Year: ${YEAR}</div>
      <div>
        CO₂ emissions:
        <strong>${formatNumber(d.emissions)} tonnes</strong>
      </div>
      ${
        Number(d.capacity) > 0 && d.capacityUnits
          ? `<div>
              Reported capacity:
              ${formatNumber(d.capacity)}
              ${escapeHTML(d.capacityUnits)}
            </div>`
          : ""
      }
    `);

  moveTooltip(event);
}

function moveTooltip(event) {
  const bounds = document.querySelector("#map")
    .getBoundingClientRect();

  const tip = tooltip.node();

  let x = event.clientX - bounds.left + 14;
  let y = event.clientY - bounds.top + 14;

  x = Math.min(x, bounds.width - tip.offsetWidth - 8);
  y = Math.min(y, bounds.height - tip.offsetHeight - 8);

  tooltip
    .style("left", `${Math.max(8, x)}px`)
    .style("top", `${Math.max(8, y)}px`);
}

function escapeHTML(value) {
  return String(value).replace(
    /[&<>"']/g,
    ch => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    })[ch]
  );
}

// Reset, create and animate particles

function resetParticle(d) {
  // Restart at the emitting facility
  d.longitude = d.originLongitude;
  d.latitude = d.originLatitude;

  d.age = 0;
  d.lifetime = 5000 + Math.random() * 5000;

  // Choose a new random direction and speed
  const angle = Math.random() * Math.PI * 2;
  const speed = 2 + Math.random() * 6;

  d.vx = Math.cos(angle) * speed;
  d.vy = Math.sin(angle) * speed * 0.7;
}

function createParticles(sources) {
  particles = [];

  const majorSources = sources
    .slice()
    .sort((a, b) => b.emissions - a.emissions)
    .slice(0, 75);

  majorSources.forEach(source => {
    const count = Math.max(
      2,
      Math.min(5, Math.round(radiusScale(source.emissions) / 3))
    );

    for (let i = 0; i < count; i++) {
      const particle = {
        originLongitude: source.longitude,
        originLatitude: source.latitude
      };

      resetParticle(particle);

      // Stagger particles so they don't all start together
      particle.age = Math.random() * particle.lifetime;

      particle.longitude +=
        particle.vx * particle.age / 2000;

      particle.latitude +=
        particle.vy * particle.age / 2000;

      particles.push(particle);
    }
  });

  particleLayer
    .selectAll(".particle")
    .data(particles)
    .join("circle")
    .attr("class", "particle")
    .attr("r", 1.6)
    .attr("fill", "#2379b8")
    .attr("pointer-events", "none");
}

function animateParticles() {
  d3.timer(elapsed => {
    const dt = Math.max(
      0,
      Math.min(0.05, (elapsed - lastElapsed) / 1000)
    );

    lastElapsed = elapsed;

    if (!isPlaying) return;

    particleLayer.selectAll(".particle")
      .each(function(d) {
        d.age += dt * 1000;

        // Give each particle a new path after its lifetime
        if (d.age >= d.lifetime) {
          resetParticle(d);
        }

        // Random wandering while moving
        const noise = 3 * Math.sqrt(dt);

        d.longitude += d.vx * dt +
          (Math.random() - 0.5) * noise;

        d.latitude += d.vy * dt +
          (Math.random() - 0.5) * noise;

        // Wrap around the longitude range
        d.longitude = (
          ((d.longitude + 180) % 360 + 360) % 360
        ) - 180;

        d.latitude = Math.max(
          -85,
          Math.min(85, d.latitude)
        );

        const point = projection([
          d.longitude,
          d.latitude
        ]);

        if (!point) return;

        const progress = d.age / d.lifetime;

        d3.select(this)
          .attr("cx", point[0])
          .attr("cy", point[1])
          .attr("opacity", 0.7 * (1 - progress))
          .attr("r", 1 + progress * 1.5);
      });
  });
}


// ==========================================
// UPDATE THE MAP
// ==========================================

function updateMap() {
  const selectedSector = d3.select("#sector-filter")
    .property("value");

  const data = allSources
    .filter(d =>
      selectedSector === "all" ||
      d.sector === selectedSector
    )
    .sort((a, b) => b.emissions - a.emissions);

  tooltip.style("display", "none");

  if (data.length === 0) {
    statusText.text("No emission sources available.");
    sourceLayer.selectAll(".source").remove();
    createParticles([]);
    return;
  }

  const maxEmissions = d3.max(
    data,
    d => d.emissions
  );

  const minEmissions = d3.min(
    data,
    d => d.emissions
  );

  radiusScale.domain([0, maxEmissions]);

  colorScale.domain([
    Math.max(1, minEmissions),
    Math.max(1.01, maxEmissions)
  ]);

  // Draw industrial sources
  const circles = sourceLayer
    .selectAll(".source")
    .data(data, d => d.id)
    .join(
      enter => enter.append("circle")
        .attr("class", "source")
        .attr("r", 0)
        .attr("opacity", 0),
      update => update,
      exit => exit.transition()
        .duration(300)
        .attr("r", 0)
        .attr("opacity", 0)
        .remove()
    );

  circles
    .attr("cx", d => projection([
      d.longitude,
      d.latitude
    ])[0])
    .attr("cy", d => projection([
      d.longitude,
      d.latitude
    ])[1])
    .on("mouseenter", showTooltip)
    .on("mousemove", moveTooltip)
    .on("mouseleave", () => {
      tooltip.style("display", "none");
    })
    .transition()
    .duration(700)
    .attr("r", 2.5)
    .attr("fill", d => colorScale(d.emissions))
    .attr("opacity", 0.8);

  // Make larger emitters appear on top
  sourceLayer.selectAll(".source")
    .sort((a, b) => a.emissions - b.emissions);

  createParticles(data);

  statusText.text(
    `Showing ${data.length} emission sources in ${YEAR}. ` +
    `These are the highest-ranked sources returned ` +
    `for the selected sectors, not every facility worldwide.`
  );
}

// ==========================================
// USER CONTROLS
// ==========================================

d3.select("#sector-filter")
  .on("change", updateMap);

d3.select("#play-button")
  .on("click", function() {
    isPlaying = !isPlaying;

    d3.select(this)
      .text(
        isPlaying
          ? "Pause Animation"
          : "Play Animation"
      );
  });

// ==========================================
// INITIALIZATION
// ==========================================

async function init() {
  try {
    // Load world boundaries
    const world = await d3.json(WORLD_URL);

    const countries = topojson.feature(
      world,
      world.objects.countries
    ).features;

    countryLayer.selectAll(".country")
      .data(countries)
      .join("path")
      .attr("class", "country")
      .attr("d", geoPath);

    statusText.text("Loading facility emissions...");

    // Load top-emitting sources from both sectors
    const [power, manufacturing] = await Promise.all([
      fetchSources("power"),
      fetchSources("manufacturing")
    ]);

    allSources = [
      ...power,
      ...manufacturing
    ];

    updateMap();
    animateParticles();

  } catch (error) {
    console.error(error);

    statusText.text(
      "Unable to load the map or emissions data. " +
      "Check the browser console and API connectivity. " +
      error.message
    );
  }
}

init();