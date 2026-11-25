
// =======================================
// DATA CONFIGURATION
// =======================================

const CO2_URL =
  "https://ourworldindata.org/grapher/annual-co2-emissions-per-country.csv?v=1&csvType=full&useColumnShortNames=false";

const TEMP_URL =
  "https://ourworldindata.org/grapher/annual-temperature-anomalies.csv?v=1&csvType=full&useColumnShortNames=false";

const COUNTRY_CODES = [
  "USA", "CHN", "IND", "DEU", "BRA",
  "JPN", "GBR", "AUS", "NGA", "ZAF"
];

const width = 1000;
const height = 590;

const margin = {
  top: 25,
  right: 120,
  bottom: 75,
  left: 180
};

const formatNumber = d3.format(",.0f");

function formatTemp(value) {
  return `${value >= 0 ? "+" : ""}${value.toFixed(2)}°C`;
}

// =======================================
// DATA PARSING
// =======================================

function parseDataset(rawData) {
  const valueColumn = rawData.columns.find(
    c => !["Entity", "Code", "Year"].includes(c)
  );

  if (!valueColumn) {
    throw new Error("Missing data column");
  }

  return rawData
    .filter(d =>
      COUNTRY_CODES.includes(d.Code) &&
      d[valueColumn] !== ""
    )
    .map(d => ({
      code: d.Code,
      country: d.Entity,
      year: +d.Year,
      value: +d[valueColumn]
    }))
    .filter(d => Number.isFinite(d.value));
}

// =======================================
// INITIALIZATION
// =======================================

async function init() {
  const status = d3.select("#status");

  try {
    const [co2Raw, tempRaw] = await Promise.all([
      d3.csv(CO2_URL),
      d3.csv(TEMP_URL)
    ]);

    const co2Data = parseDataset(co2Raw);
    const tempData = parseDataset(tempRaw);

    const co2Lookup = new Map(
      co2Data.map(d => [
        `${d.code}-${d.year}`, d
      ])
    );

    const tempLookup = new Map(
      tempData.map(d => [
        `${d.code}-${d.year}`, d
      ])
    );

    // Latest year with complete data for every country
    const years = [...new Set(
      co2Data.map(d => d.year)
    )].sort((a, b) => b - a);

    const year = years.find(y =>
      COUNTRY_CODES.every(code =>
        co2Lookup.has(`${code}-${y}`) &&
        tempLookup.has(`${code}-${y}`)
      )
    );

    if (year === undefined) {
      throw new Error("No complete common year found");
    }

    const data = COUNTRY_CODES.map(code => {
      const emissions = co2Lookup.get(`${code}-${year}`);
      const temperature = tempLookup.get(`${code}-${year}`);

      return {
        code,
        country: emissions.country,
        emissions: emissions.value / 1_000_000,
        temperature: temperature.value
      };
    });

    // Keep the ranking consistent in both views
    data.sort((a, b) => b.emissions - a.emissions);

    d3.select("#year-label").text(year);

    status.text(
      `Showing ${year} data for ${data.length} countries.`
    );

    // =======================================
    // CREATE CHART
    // =======================================

    const chart = d3.select("#chart");

    const svg = chart
      .append("svg")
      .attr("viewBox", `0 0 ${width} ${height}`);

    const tooltip = chart.select(".tooltip");

    const y = d3.scaleBand()
      .domain(data.map(d => d.code))
      .range([
        margin.top,
        height - margin.bottom
      ])
      .padding(0.22);

    // Scale for CO2 emissions
    const xCO2 = d3.scaleLinear()
      .domain([
        0,
        d3.max(data, d => d.emissions) * 1.1
      ])
      .nice()
      .range([
        margin.left,
        width - margin.right
      ]);

    // Scale for temperature anomalies
    const minTemp = d3.min(
      data, d => d.temperature
    );

    const maxTemp = d3.max(
      data, d => d.temperature
    );

    const tempPadding = 0.2;

    const xTemp = d3.scaleLinear()
      .domain([
        Math.min(0, minTemp) - tempPadding,
        Math.max(0, maxTemp) + tempPadding
      ])
      .nice()
      .range([
        margin.left,
        width - margin.right
      ]);

    // =======================================
    // AXES
    // =======================================

    const xAxis = svg.append("g")
      .attr("class", "axis")
      .attr(
        "transform",
        `translate(0, ${height - margin.bottom})`
      );

    const yAxis = svg.append("g")
      .attr("class", "axis")
      .attr(
        "transform",
        `translate(${margin.left}, 0)`
      )
      .call(
        d3.axisLeft(y)
          .tickFormat(code => {
            return data.find(
              d => d.code === code
            )?.country;
          })
      );

    const zeroLine = svg.append("line")
      .attr("y1", margin.top)
      .attr("y2", height - margin.bottom)
      .attr("stroke", "#8195aa")
      .attr("stroke-dasharray", "4,4")
      .attr("opacity", 0);

    const barsGroup = svg.append("g");
    const labelsGroup = svg.append("g");

    const axisTitle = svg.append("text")
      .attr("x", width / 2)
      .attr("y", height - 20)
      .attr("text-anchor", "middle")
      .attr("fill", "#334155")
      .attr("font-size", 14);

    // =======================================
    // CREATE BARS AND LABELS
    // =======================================

    const bars = barsGroup
      .selectAll(".bar")
      .data(data, d => d.code)
      .join("rect")
      .attr("class", "bar")
      .attr("x", xCO2(0))
      .attr("y", d => y(d.code))
      .attr("width", 0)
      .attr("height", y.bandwidth())
      .attr("rx", 3)
      .attr("fill", "#519bd0");

    const labels = labelsGroup
      .selectAll(".value-label")
      .data(data, d => d.code)
      .join("text")
      .attr("class", "value-label")
      .attr("x", xCO2(0) + 8)
      .attr(
        "y",
        d => y(d.code) + y.bandwidth() / 2
      )
      .attr("dominant-baseline", "middle")
      .attr("opacity", 0);
    
    
    const nigeriaNote = svg.append("g")
    .attr("class", "nigeria-annotation")
    .attr("pointer-events", "none");

    nigeriaNote.append("line")
    .attr("x1", 0)
    .attr("x2", 20)
    .attr("y1", 0)
    .attr("y2", 0);

    const nigeriaNoteText = nigeriaNote.append("text")
    .attr("x", 27)
    .attr("y", 4);


    // =======================================
    // TOOLTIP
    // =======================================

    let currentMode = "emissions";
    let replayTimer = null;

    bars
      .on("mouseenter", (event, d) => {
        tooltip
          .style("display", "block")
          .text(
            `${d.country}\n` +
            `Year: ${year}\n` +
            `CO₂ emissions: ${formatNumber(d.emissions)} million tonnes\n` +
            `Temperature anomaly: ${formatTemp(d.temperature)}`
          );

        moveTooltip(event);
      })
      .on("mousemove", moveTooltip)
      .on("mouseleave", () => {
        tooltip.style("display", "none");
      });

    function moveTooltip(event) {
      const bounds = chart.node()
        .getBoundingClientRect();

      const tip = tooltip.node();

      let left = event.clientX - bounds.left + 12;
      let top = event.clientY - bounds.top + 12;

      left = Math.min(
        left,
        bounds.width - tip.offsetWidth - 8
      );

      top = Math.min(
        top,
        bounds.height - tip.offsetHeight - 8
      );

      tooltip
        .style("left", `${Math.max(8, left)}px`)
        .style("top", `${Math.max(8, top)}px`);
    }

    // =======================================
    // BAR COLOR
    // =======================================

    
    function getColor(d, mode) {
    // Keep Nigeria highlighted in both views
    if (d.code === "NGA") {
        return "#8057be";
    }

    if (mode === "emissions") {
        return d.code === data[0].code
        ? "#df8546"
        : "#519bd0";
    }

    return d.temperature >= 0
        ? "#e5684a"
        : "#4ca6db";
    }


    // =======================================
    // MAIN TRANSITION
    // =======================================

    function render(mode, duration = 1200) {
      currentMode = mode;

      const emissionsMode = mode === "emissions";

      const x = emissionsMode ? xCO2 : xTemp;

      const value = emissionsMode
        ? d => d.emissions
        : d => d.temperature;

      tooltip.style("display", "none");

      // Update interface
      d3.select("#toggle-button").text(
        emissionsMode
          ? "Show Temperature"
          : "Show CO₂ Emissions"
      );

      d3.select("#metric-title").text(
        emissionsMode
          ? `Annual CO₂ Emissions — ${year}`
          : `Temperature Anomalies — ${year}`
      );

      d3.select("#metric-description").text(
        emissionsMode
          ? "Annual territorial CO₂ emissions (million tonnes)"
          : "Annual temperature relative to the 1991–2020 average (°C)"
      );

      axisTitle.text(
        emissionsMode
          ? "Annual CO₂ emissions (million tonnes)"
          : "Temperature anomaly (°C)"
      );

      const t = svg.transition()
        .duration(duration)
        .ease(d3.easeCubicInOut);
    

      
    // Nigeria annotation follows its bar
    const nigeria = data.find(d => d.code === "NGA");

    if (nigeria) {
    nigeriaNoteText.text(
        emissionsMode
        ? "Low total emissions"
        : `Yet ${formatTemp(nigeria.temperature)} anomaly`
    );

    nigeriaNote
        .transition(t)
        .attr(
        "transform",
        `translate(
            ${x(value(nigeria)) + 44},
            ${y(nigeria.code) + y.bandwidth() / 2}
        )`
        );
    }


      // Change horizontal axis
      xAxis
        .transition(t)
        .call(
          d3.axisBottom(x)
            .ticks(7)
            .tickFormat(
              emissionsMode
                ? d => formatNumber(d)
                : d => `${d.toFixed(1)}°`
            )
        );

      // Move zero line for temperature
      zeroLine
        .transition(t)
        .attr("x1", x(0))
        .attr("x2", x(0))
        .attr("opacity", emissionsMode ? 0 : 1);

      // Animate bars to their new positions
      bars
        .transition(t)
        .attr("x", d =>
          Math.min(x(0), x(value(d)))
        )
        .attr("width", d =>
          Math.abs(x(value(d)) - x(0))
        )
        .attr("fill", d => getColor(d, mode));

      // Animate values
      labels
        .text(d =>
          emissionsMode
            ? formatNumber(d.emissions)
            : formatTemp(d.temperature)
        )
        .transition(t)
        .attr("x", d =>
          x(value(d)) + (value(d) < 0 ? -8 : 8)
        )
        .attr("text-anchor", d =>
          value(d) < 0 ? "end" : "start"
        )
        .attr("opacity", 1);

      // =======================================
      // INSIGHT TEXT
      // =======================================

      if (emissionsMode) {
        const highest = data[0];
        const lowest = data[data.length - 1];

        const ratio =
          highest.emissions / lowest.emissions;

        d3.select("#insight").text(
          `In ${year}, among these ${data.length} countries, ` +
          `${highest.country} emitted ${ratio.toFixed(1)} ` +
          `times as much CO₂ as ${lowest.country} ` +
          `in total annual emissions.`
        );
      } else {
        const sorted = [...data].sort(
          (a, b) => b.temperature - a.temperature
        );

        const highest = sorted[0];
        const lowest = sorted[sorted.length - 1];

        d3.select("#insight").text(
          `In ${year}, all ${data.length} selected countries ` +
          `are shown on the same temperature-anomaly scale. ` +
          `The highest anomaly was ${formatTemp(highest.temperature)} ` +
          `in ${highest.country}, compared with ` +
          `${formatTemp(lowest.temperature)} in ` +
          `${lowest.country}. Unlike emissions, local ` +
          `temperature anomalies are influenced by the ` +
          `global climate system and regional variability.`
        );
      }
    }

    // =======================================
    // CONTROLS
    // =======================================

    d3.select("#toggle-button")
      .on("click", () => {
        clearTimeout(replayTimer);

        const nextMode = currentMode === "emissions"
          ? "temperature"
          : "emissions";

        render(nextMode, 1300);
      });

    d3.select("#replay-button")
      .on("click", () => {
        clearTimeout(replayTimer);

        // Show emissions first
        render("emissions", 550);

        // Then dramatically transform to warming
        replayTimer = setTimeout(() => {
          render("temperature", 1450);
        }, 850);
      });

    // Start with emissions
    render("emissions", 1100);

  } catch (error) {
    console.error(error);

    status.text(
      "Unable to load data: " + error.message
    );
  }
}

init();