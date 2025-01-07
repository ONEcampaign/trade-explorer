import * as Plot from "npm:@observablehq/plot";
import { groupData } from "./groupData.js";
import { xDomain } from "./xDomain.js";
import { yDomain } from "./yDomain.js";
import { formatYear } from "./formatYear.js";
import { formatValue } from "./formatValue.js";
import { colorPalette } from "./colorPalette.js";
import { reactiveWidth } from "./reactiveWidth.js"

export function plotSingle(data, country, partner, timeRange, categories, unit) {

    const dataFiltered = data.filter(
        (d) =>
            d.country == country &&
            d.partner == partner &&
            categories.includes(d.category) &&
            d[unit] != null
        )

    const dataByYear = groupData(dataFiltered, ["year"], unit)

    return Plot.plot({
        width: reactiveWidth,
        height: 500,
        marginTop: 25,
        marginRight: 25,
        marginBottom: 25,
        marginLeft: 75,
        x: {
            domain: xDomain(timeRange),
            label: null,
            tickSize: 0,
            tickFormat: formatYear,
            type: "band"
        },
        y: {
            domain: yDomain(dataByYear, timeRange, null, "single"),
            label: unit === "pct_gdp" ? "% GDP" : "Million USD",
            tickSize: 0,
            ticks: 5,
            grid: true
        },
        color: {
            domain: ["imports", "exports"],
            range: [colorPalette.imports, colorPalette.exports]
        },
        marks: [

          // Bars for imports and exports
          Plot.barY(
            dataFiltered, {
                x: "year",
                y: unit,
                opacity: 0.6,
                fill: "flow",
                title: (d) => `${formatYear(d.year)} ${d.flow}\n${d.category}\n${formatValue(d[unit]).label} ${unit === "pct_gdp" ? "%" : "USD"} ${unit === "pct_gdp" ? "" : "M"}`,
                tip: true
            }
          ),

          // Exports reactivity
          Plot.barY(
            dataFiltered,
            Plot.pointer({
              x: "year",
              y: unit,
              opacity: 1,
              fill: "flow",
              stroke: "black",
              strokeWidth: 1
            })
          ),

          // Horizontal line at 0
          Plot.ruleY([0], {
            stroke: "black",
            strokeWidth: 1
          }),

          // Line for balance
          Plot.line(dataByYear, {
            x: "year",
            y: "balance",
            curve: "catmull-rom",
            stroke: colorPalette.balance,
            strokeWidth: 2
          }),

          // Points for balance
          Plot.dot(dataByYear, {
            x: "year",
            y: "balance",
            fill: colorPalette.balance,
            stroke: colorPalette.balance,
            strokeWidth: 3,
            title: (d) => `${formatYear(d.year)} Trade balance\nUSD ${formatValue(d.balance).label} M`
          }),

//          // Labels for total exports at the top
//          Plot.text(dataByYear, {
//            x: "year",
//            y: (d) => d.exports,
//            text: (d) => `${formatValue(d.exports).label}`,
//            dy: -10, // Offset text above the bar
//            className: "export-label"
//          }),
//
//          // Labels for total imports at the bottom
//          Plot.text(dataByYear, {
//            x: "year",
//            y: (d) => d.imports,
//            text: (d) => `${formatValue(d.imports).label}`,
//            dy: 10, // Offset text below the bar
//            className: "import-label"
//          })
        ]
    })
}