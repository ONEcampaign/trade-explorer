import * as Plot from "npm:@observablehq/plot";
import { groupData } from "./groupData.js";
import { xDomain } from "./xDomain.js";
import { yDomain } from "./yDomain.js";
import { formatYear } from "./formatYear.js";
import { formatValue } from "./formatValue.js";
import { reactiveWidth } from "./reactiveWidth.js"
import { jitterLabels } from "./jitterLabels.js"

export function plotMulti(data, countries, partner, timeRange, categories, unit, flow) {

    const dataFiltered = data.filter(
        (d) =>
            countries.includes(d.country) &&
            d.partner == partner &&
            categories.includes(d.category) &&
            d[unit] != null
        )

    const groupedData = groupData(dataFiltered, ["year", "country"], unit)

    return Plot.plot({
      width: reactiveWidth,
      height: 500,
      marginTop: 25,
      marginRight: 75,
      marginBottom: 25,
      marginLeft: 75,
      x: {
        domain: xDomain(timeRange),
        type: "band",
        label: null,
        tickSize: 0,
        ticks: 5,
        tickFormat: formatYear
      },
      y: {
        domain: yDomain(
          groupedData,
          timeRange,
          flow,
          "multi"
        ),
        className: "axis-labels-y",
        label: unit === "pct_gdp" ? "% GDP" : "Million USD",
        tickSize: 0,
        ticks: 5,
        grid: true
      },
      color: {
        scheme: "observable10"
      },
      marks: [
        // Horizontal line at 0
        Plot.ruleY([0], {
          stroke: "black",
          strokeWidth: 0.5
        }),

        // Lines for each country
        Plot.line(groupedData, {
          x: "year",
          y: flow,
          z: "country",
          curve: "catmull-rom",
          stroke: "country",
          strokeWidth: 2
        }),

        // Dots for each point
        Plot.dot(groupedData, {
          x: "year",
          y: flow,
          z: "country",
          fill: "country",
          title: (d) => `${d.country}, ${d.year}\n${flow}: ${formatValue(d[flow]).label}${unit === "pct_gdp" ? " %" : " USD M"}`,
          tip: true
        }),

        // Country labels
        Plot.text(
          jitterLabels(
            groupedData,
            flow
          ),
          {
            x: "year",
            y: flow,
            fill: "country",
            text: "country",
            dx: 10,
            frameAnchor: "left",
            className: "country-label"
          }
        )
      ]
    })
}