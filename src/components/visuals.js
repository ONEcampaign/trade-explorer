import { plot, rectY, line, ruleY, tip, pointer } from "npm:@observablehq/plot";
import { table } from "npm:@observablehq/inputs";
import { html } from "npm:htl";
import { utcYear } from "npm:d3-time";
import { timeFormat } from "npm:d3-time-format";
import { customPalette, singlePalette, multiPalette } from "./colors.js";
import {
  formatValue,
  formatString,
  getUnitLabel,
  getLimits,
  reshapeDataForTable,
} from "./utils.js";


// Function to get color by domain
function getSingleColor(key) {
    const index = singlePalette.domain.indexOf(key);
    return index !== -1 ? singlePalette.range[index] : null; // Return color if found, otherwise null
};

export function topPartnersTable(data, flow, width) {

    const mainColumn = data.some(row => "category" in row) ? "category" : "partner";

    const tableData = data
        .filter(row => row.flow === flow)
        .map(row => ({
            [mainColumn]: row[mainColumn], // Extract dynamically
            [flow]: row.value // Dynamically set column name
        }));

    const values = tableData.map(row => row[flow]);
    const limits = [Math.min(...values), Math.max(...values)];

    const alignmentMapping = {
        partner: "left",
        imports: "right",
        exports: "left",
    };

    return table(tableData, {
        sort: flow,
        reverse: flow ===  "exports",
        format: {
            category: (x) => x, // General formatter for groupKey (year or category)
            ...Object.fromEntries(
                Object.keys(tableData[0]) // Get all columns
                    .filter((key) => key !== mainColumn)
                    .map((key, index) => [
                        key,
                        sparkbar(
                            getSingleColor(key),
                            alignmentMapping[key],
                            limits[0],
                            limits[1],
                        ),
                    ]),
            ),
        },
        header: {
            ...Object.fromEntries(
                Object.keys(tableData[0]).map((key) => [key, formatString(key)]),
            ),
        },
        align: alignmentMapping,
        width: width,
        // height: width * 0.4,
    });

}


export function tradePlot(data, flow, width) {
    const isMulti = new Set(data.map(row => row.partner)).size > 1;

    if (isMulti) {
        return plotMulti(data, flow, width);
    } else {
        return plotSingle(data, width);
    }
}

export function tradeTable(data, flow, width) {
    const isMulti = new Set(data.map(row => row.partner)).size > 1;

    if (isMulti) {
        return tableMulti(data, flow, width);
    } else {
        return tableSingle(data, width);
    }
}


export function plotSingle(data, width) {
  let formattedData = data.map((row) => ({
    ...row,
    year: new Date(row.year, 1, 1), // Ensure year is just the integer
  }));

  const isGDP = formattedData[0].unit === "share of gdp";
  const unit = isGDP ? "gdp" : formattedData[0].unit.split(" ")[1];

  formattedData = formattedData.reduce(
    (acc, { year, imports, exports, balance, gdp }) => {
      // Initialize the accumulator for each year if not already initialized
      if (!acc[year]) {
        acc[year] = { year: year, exports: 0, imports: 0, balance: 0, gdp: 0 };
      }

      // Sum up exports, imports, balance, and gdp
      acc[year].exports += exports;
      acc[year].imports += imports;
      acc[year].balance += balance;
      acc[year].gdp = gdp; // Assuming GDP remains constant for the year

      return acc;
    },
    {},
  );

  // Convert the object into an array with the desired format
  const plotData = Object.values(formattedData)
    .flatMap((yearData) => {
      const { year, exports, imports, balance, gdp } = yearData;
      const factor = isGDP && gdp ? 100 / gdp : 1;

      return [
        { Year: year, Flow: "exports", Value: exports * factor },
        { Year: year, Flow: "imports", Value: imports * factor },
        { Year: year, Flow: "balance", Value: balance * factor },
      ];
    })
    .sort((a, b) => a.Year - b.Year);

  const formatYear = timeFormat("%Y");

  return plot({
    width: width,
    height: width * 0.5,
    marginTop: 25,
    marginRight: 25,
    marginBottom: 25,
    marginLeft: 75,
    x: {
      inset: 10,
      label: null,
      tickSize: 0,
      ticks: 5,
      grid: false,
      tickFormat: "%Y",
      tickPadding: 10,
      interval: utcYear,
    },
    y: {
      inset: 5,
      label: getUnitLabel(unit, {}),
      tickSize: 0,
      ticks: 4,
      grid: true,
    },
    color: singlePalette,
    marks: [
      // Imports/exports bars
      rectY(plotData, {
        filter: (d) => d.Flow !== "balance",
        x: "Year",
        y: "Value",
        fill: "Flow",
        // opacity: .75
      }),

      // Horizontal line at 0
      ruleY([0], {
        stroke: "black",
        strokeWidth: 0.5,
      }),

      // Line for balance
      line(plotData, {
        filter: (d) => d.Flow === "balance",
        x: "Year",
        y: "Value",
        stroke: "Flow",
        curve: "monotone-x",
        strokeWidth: 2.5,
      }),

      tip(
        plotData,
        pointer({
          x: "Year",
          y: "Value",
          fill: "Flow",
          format: {
            fill: (d) => formatString(d),
            x: (d) => formatYear(d),
            y: (d) => `${formatValue(d).label}`,
            stroke: true,
          },
          lineHeight: 1.25,
          fontSize: 12,
        }),
      ),
    ],
  });
}


export function plotMulti(data, flow, width) {
  let formattedData = data.map((row) => ({
    ...row,
    year: new Date(row.year, 1, 1),
  }));

  const isGDP = formattedData[0].unit === "share of gdp";
  const unit = isGDP ? "gdp" : formattedData[0].unit.split(" ")[1];

  formattedData = formattedData.reduce(
    (acc, { year, partner, imports, exports, balance, gdp }) => {
      let key = `${year}||${partner}`; // Unique key for grouping by year-partner

      if (!acc[key]) {
        acc[key] = {
          year,
          partner,
          imports: 0,
          exports: 0,
          balance: 0,
          gdp: 0,
        };
      }

      acc[key][flow] += { imports, exports, balance }[flow];

      if (isGDP) {
        acc[key].gdp += gdp;
      }

      return acc;
    },
    {},
  );

  // Convert the object into an array with the desired format
  const plotData = Object.values(formattedData)
    .map(({ year, partner, imports, exports, balance, gdp }) => {
      let value = { imports, exports, balance }[flow];
      const factor = isGDP && gdp ? 100 / gdp : 1;

      return {
        Year: year,
        Partner: partner,
        Flow: flow,
        Value: value * factor,
      };
    })
    .sort((a, b) => a.Year - b.Year);

  const formatYear = timeFormat("%Y");

  const colorPalette = {
      domain: [...new Set(plotData.map(row => row["Partner"]))].sort(),
      range: multiPalette
  };

  return plot({
    width: width,
    height: width * 0.5,
    marginTop: 25,
    marginRight: 25,
    marginBottom: 25,
    marginLeft: 75,
    x: {
      inset: 10,
      label: null,
      tickSize: 0,
      ticks: 5,
      grid: false,
      tickFormat: "%Y",
      tickPadding: 10,
      interval: utcYear,
    },
    y: {
      inset: 5,
      label: getUnitLabel(unit, {}),
      tickSize: 0,
      ticks: 4,
      grid: true,
    },
    color: colorPalette,
    marks: [
      // Horizontal line at 0
      ruleY([0], {
        stroke: "black",
        strokeWidth: 0.5,
      }),

      // Lines for each country
      line(plotData, {
        x: "Year",
        y: "Value",
        z: "Partner",
        curve: "monotone-x",
        stroke: "Partner",
        strokeWidth: 2.5,
      }),
      tip(
        plotData,
        pointer({
          x: "Year",
          y: "Value",
          fill: "Partner",
          format: {
            fill: true,
            x: (d) => formatYear(d),
            y: (d) => `${formatValue(d).label}`,
            stroke: true,
          },
          lineHeight: 1.25,
          fontSize: 12,
        }),
      ),
    ],
  });
}

export function tableSingle(data, width) {
  const isGDP = data[0].unit === "share of gdp";

  let tableData = Object.values(
    data.reduce((acc, { category, imports, exports, balance, gdp }) => {
      if (!acc[category]) {
        acc[category] = {
          category,
          imports: 0,
          exports: 0,
          balance: 0,
          gdp: 0,
        };
      }

      acc[category].imports += imports;
      acc[category].exports += exports;
      acc[category].balance += balance;

      if (isGDP) {
        acc[category].gdp += gdp;
      }

      return acc;
    }, {}),
  );

  tableData.forEach((entry) => {
    if (isGDP) {
      entry.imports = (entry.imports / entry.gdp) * 100;
      entry.exports = (entry.exports / entry.gdp) * 100;
      entry.balance = (entry.balance / entry.gdp) * 100;
    }
    delete entry.gdp;
  });

  const limits = getLimits(tableData);

  const alignmentMapping = {
    year: "left",
    imports: "right",
    exports: "left",
    balance: "center",
  };

  return table(tableData, {
    sort: "exports", // Sort by year or exports
    reverse: true, // Reverse sort only for category-based tables
    format: {
      category: (x) => x, // General formatter for groupKey (year or category)
      ...Object.fromEntries(
        Object.keys(tableData[0]) // Get all columns
          .filter((key) => key !== "category") // Exclude the grouping key (year or category)
          .map((key, index) => [
            key,
            sparkbar(
              singlePalette.range[index], // Cycle through colors
              alignmentMapping[key],
              limits[0],
              limits[1],
            ),
          ]),
      ),
    },
    header: {
      ...Object.fromEntries(
        Object.keys(tableData[0]).map((key) => [key, formatString(key)]),
      ),
    },
    align: alignmentMapping,
    width: width,
    height: width * 0.5,
  });
}


export function tableMulti(data, flow, width) {
  const isGDP = data[0].unit === "share of gdp";

  let groupedData = Object.values(
    data.reduce(
      (acc, { category, partner, imports, exports, balance, gdp }) => {
        let key = `${category}||${partner}`; // Unique key for category-partner grouping

        if (!acc[key]) {
          acc[key] = {
            category,
            partner,
            imports: 0,
            exports: 0,
            balance: 0,
            gdp: 0,
          };
        }

        acc[key][flow] += { imports, exports, balance }[flow];

        if (isGDP) {
          acc[key].gdp += gdp;
        }

        return acc;
      },
      {},
    ),
  );

  groupedData.forEach((entry) => {
    if (isGDP) {
      entry[flow] = (entry[flow] / entry.gdp) * 100;
    }
    delete entry.gdp;
  });

  const tableData = reshapeDataForTable(groupedData, flow, "category");

  const countries = Object.keys(tableData[0]).filter(
    (key) => key !== "category",
  );

  const limits = getLimits(tableData);

  const colors = multiPalette;

  return table(tableData, {
    format: {
      category: (x) => x, // General formatter for groupKey (year or category)
      ...Object.fromEntries(
        countries.map((key, index) => [
          key,
          sparkbar(
            colors[index % colors.length], // Cycle through colors
            "center",
            limits[0],
            limits[1],
          ),
        ]),
      ),
    },
    header: {
      category: formatString("category"),
    },
    align: {
      category: "left",
      ...Object.fromEntries(
        countries.map((key) => [key, "center"]), // Corrected syntax here
      ),
    },
    width: width,
    height: width * 0.5,
  });
}


function sparkbar(fillColor, alignment, globalMin, globalMax) {
  const range = Math.abs(globalMax) + Math.abs(globalMin);
  const zeroPosition = Math.abs(globalMin) / range;

  return (x) => {
    const barWidth = Math.min(100, (100 * Math.abs(x)) / range);

    const barStyle =
      alignment === "center"
        ? `
          position: absolute;
          height: 80%;
          top: 10%;
          background: ${hex2rgb(fillColor, 0.4)};
          width: ${barWidth}%;
          ${
            x >= 0
              ? `left: ${zeroPosition * 100}%;`
              : `right: ${(1 - zeroPosition) * 100}%;`
          }
        `
        : `
          position: absolute;
          height: 80%;
          top: 10%;
          background: ${hex2rgb(fillColor, 0.4)};
          width: ${barWidth}%;
          ${alignment === "right" ? "right: 0;" : "left: 0;"};
        `;

    // Zero line style with full height
    const zeroLineStyle =
      alignment === "center"
        ? `
          position: absolute;
          height: 100%;
          width: 1px;
          background: ${hex2rgb(customPalette.midGrey, 0.5)};
          left: ${zeroPosition * 100}%;
        `
        : alignment === "right"
          ? `
          position: absolute;
          height: 100%;
          width: 1px;
          background: ${hex2rgb(customPalette.midGrey, 0.5)};
          right: 0;
        `
          : `
          position: absolute;
          height: 100%;
          width: 1px;
          background: ${hex2rgb(customPalette.midGrey, 0.5)};
          left: 0;
        `;

    // Text alignment based on alignment type
    const textAlignment =
      alignment === "center"
        ? "center"
        : alignment === "right"
          ? "end" // Right-align text
          : "start"; // Left-align text

    return html` <div
      style="
      position: relative;
      width: 100%;
      height: var(--size-l);
      background: none;
      display: flex;
      z-index: 0;
      align-items: center;
      justify-content: ${textAlignment};
      box-sizing: border-box;"
    >
      <div style="${barStyle}"></div>
      <div style="${zeroLineStyle}"></div>
      <!-- Zero line -->
      <span
        style="
          position: relative;
          z-index: 0;
          font-size: var(--size-s);
          font-size: var(--size-s);
          color: black;
          text-shadow: .5px .5px 0 ${customPalette.lightGrey};
          padding: 0 3px;"
      >
        ${formatValue(x).label}
      </span>
    </div>`;
  };
}


function hex2rgb(hex, alpha = 1) {
  // Remove the hash if present
  hex = hex.replace(/^#/, "");

  // Parse the hex into RGB components
  let r,
    g,
    b,
    a = 1; // Default alpha is 1

  if (hex.length === 6) {
    // If hex is #RRGGBB
    r = parseInt(hex.slice(0, 2), 16);
    g = parseInt(hex.slice(2, 4), 16);
    b = parseInt(hex.slice(4, 6), 16);
  } else if (hex.length === 8) {
    // If hex is #RRGGBBAA
    r = parseInt(hex.slice(0, 2), 16);
    g = parseInt(hex.slice(2, 4), 16);
    b = parseInt(hex.slice(4, 6), 16);
    a = parseInt(hex.slice(6, 8), 16) / 255; // Alpha is in [0, 255]
  } else {
    throw new Error("Invalid hex format. Use #RRGGBB or #RRGGBBAA.");
  }

  // Combine the RGBA components into a CSS string
  return `rgba(${r}, ${g}, ${b}, ${a * alpha})`;
}
