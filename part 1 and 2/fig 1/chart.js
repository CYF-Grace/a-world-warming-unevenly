
const dataURL =
  "https://ourworldindata.org/grapher/co-emissions-per-capita.csv?v=1&csvType=full&useColumnShortNames=false";

const selectedCountries = [
  "USA", "CHN", "IND", "DEU", "BRA",
  "JPN", "GBR", "AUS", "NGA", "ZAF"
];

async function init() {
  const rawData = await d3.csv(dataURL);

  const emissionColumn = rawData.columns.find(
    column => !["Entity", "Code", "Year"].includes(column)
  );

  const allData = rawData
    .filter(d =>
      selectedCountries.includes(d.Code) &&
      +d.Year >= 1990 &&
      +d.Year <= 2025
    )
    .map(d => ({
      country: d.Entity,
      year: +d.Year,
      emissions: +d[emissionColumn]
    }))
    .filter(d =>
      Number.isFinite(d.emissions) &&
      d.emissions >= 0 &&
      d[emissionColumn] !== ""
    );

  // Chart dimensions
  const width = 900;
  const height = 550;
  const margin = {
    top: 30,
    right: 80,
    bottom: 60,
    left: 160
  };

  const svg = d3.select("#chart")
    .append("svg")
    .attr("viewBox", `0 0 ${width} ${height}`)
    .style("max-width", "100%");

  const tooltip = d3.select("#chart")
    .append("div")
    .attr("class", "tooltip");

  // Fixed horizontal scale for consistent comparison
  const x = d3.scaleLinear()
    .domain([0, d3.max(allData, d => d.emissions) * 1.1])
    .range([margin.left, width - margin.right]);

  const y = d3.scaleBand()
    .range([margin.top, height - margin.bottom])
    .padding(0.2);

  // Create axes once
  const xAxis = svg.append("g")
    .attr("transform", `translate(0, ${height - margin.bottom})`)
    .call(d3.axisBottom(x));

  const yAxis = svg.append("g")
    .attr("transform", `translate(${margin.left}, 0)`);

  // Separate layers for bars and labels
  const barsGroup = svg.append("g");
  const labelsGroup = svg.append("g");


  const nigeriaNote = svg.append("g")
    .attr("class", "nigeria-annotation")
    .attr("pointer-events", "none");

  nigeriaNote.append("line")
    .attr("x1", 0)
    .attr("x2", 20)
    .attr("y1", 0)
    .attr("y2", 0);

  nigeriaNote.append("text")
    .attr("x", 27)
    .attr("y", 4)
    .text("Low emissions per person");

  svg.append("text")
    .attr("x", width / 2)
    .attr("y", height - 10)
    .attr("text-anchor", "middle")
    .text("Annual CO₂ emissions (tonnes per person)");

  function updateChart(year) {
    const data = allData
      .filter(d => d.year === year)
      .sort((a, b) => b.emissions - a.emissions);

    
    // Calculate emissions inequality
    if (data.length >= 2) {
    const highest = data[0];
    const lowest = data[data.length - 1];

    const gap = highest.emissions - lowest.emissions;

    const ratio = lowest.emissions > 0
        ? highest.emissions / lowest.emissions
        : null;

    const summary = ratio !== null
        ? `${ratio.toFixed(1)} times as much`
        : "a ratio that cannot be calculated because the lowest value is zero";

    d3.select("#inequality-summary")
        .text(
        `In ${year}, among the ${data.length} selected countries, ` +
        `${highest.country} emitted ${summary} CO₂ per person ` +
        `as ${lowest.country}. ` +
        `The difference was ${gap.toFixed(2)} tonnes per person.`
        );
    }

    // Update country positions
    y.domain(data.map(d => d.country));

    const t = svg.transition().duration(750);

    const nigeria = data.find(
      d => d.country === "Nigeria"
    );

    if (nigeria) {
      nigeriaNote
        .transition(t)
        .attr(
          "transform",
          `translate(
            ${x(nigeria.emissions) + 42},
            ${y(nigeria.country) + y.bandwidth() / 2}
          )`
        );
    } else {
      nigeriaNote.attr("display", "none");
    }

    // Animate Y-axis ordering
    yAxis.transition(t)
      .call(d3.axisLeft(y));

    // Update bars, preserving country identity
    const bars = barsGroup.selectAll(".bar")
      .data(data, d => d.country)
      .join(
        enter => enter.append("rect")
          .attr("class", "bar")
          .attr("x", x(0))
          .attr("y", d => y(d.country))
          .attr("width", 0)
          .attr("height", y.bandwidth())
          .attr("fill", "steelblue"),
        update => update,
        exit => exit.transition(t)
          .attr("width", 0)
          .remove()
      );

    bars
      .on("mouseenter", (event, d) => {
        tooltip
          .style("display", "block")
          .text(
            `${d.country}\nYear: ${year}\nCO₂ per capita: ${d.emissions.toFixed(2)} tonnes`
          );
      })
      .on("mousemove", event => {
        const rect = document.querySelector("#chart")
          .getBoundingClientRect();

        tooltip
          .style("left", `${event.clientX - rect.left + 12}px`)
          .style("top", `${event.clientY - rect.top - 10}px`);
      })
      .on("mouseleave", () => {
        tooltip.style("display", "none");
      })
      
      .transition(t)
      .attr("y", d => y(d.country))
      .attr("width", d => x(d.emissions) - x(0))
      .attr("height", y.bandwidth())
      .attr("fill", d => {
        if (d.country === "Nigeria") {
          return "#8057be";
        }

        if (d.country === data[0].country) {
          return "#df8546";
        }

        if (d.country === data[data.length - 1].country) {
          return "#1e9b83";
        }

        return "#519bd0";
      });


    // Update numerical labels
    labelsGroup.selectAll(".value-label")
      .data(data, d => d.country)
      .join(
        enter => enter.append("text")
          .attr("class", "value-label")
          .attr("x", x(0) + 5)
          .attr("y", d => y(d.country) + y.bandwidth() / 2)
          .attr("opacity", 0),
        update => update,
        exit => exit.remove()
      )
      .attr("dominant-baseline", "middle")
      .attr("font-size", 12)
      .text(d => d.emissions.toFixed(1))
      .transition(t)
      .attr("x", d => x(d.emissions) + 5)
      .attr("y", d => y(d.country) + y.bandwidth() / 2)
      .attr("opacity", 1);
  }
  
// Connect slider and playback controls
const slider = d3.select("#year-slider");
const yearLabel = d3.select("#year-value");
const playButton = d3.select("#play-button");

const minYear = +slider.attr("min");
const maxYear = +slider.attr("max");

let intervalId = null;

function setYear(year) {
  slider.property("value", year);
  yearLabel.text(year);
  tooltip.style("display", "none");
  updateChart(year);
}

function stopPlayback() {
  clearInterval(intervalId);
  intervalId = null;
  playButton.text("Play");
}

// Manual slider interaction
slider.on("input", function() {
  stopPlayback();
  setYear(+this.value);
});

// Play/Pause interaction
playButton.on("click", function() {
  // If already playing, pause
  if (intervalId !== null) {
    stopPlayback();
    return;
  }

  // Restart from 1990 if already at the end
  if (+slider.property("value") >= maxYear) {
    setYear(minYear);
  }

  playButton.text("Pause");

  intervalId = setInterval(() => {
    const currentYear = +slider.property("value");
    const nextYear = currentYear + 1;

    if (nextYear <= maxYear) {
      setYear(nextYear);
    }

    // Stop automatically at the final year
    if (nextYear >= maxYear) {
      stopPlayback();
    }
  }, 1100);
});

    // Initial chart
    setYear(+slider.property("value"));
}


init().catch(console.error);