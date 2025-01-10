import * as Plot from "npm:@observablehq/plot";
import {groupData} from "./groupData.js";
import {xDomain} from "./xDomain.js";
import {yDomain} from "./yDomain.js";
import {formatYear} from "./formatYear.js";
import {formatValue} from "./formatValue.js";
import {colorPalette} from "./colorPalette.js";
import {formatString} from "./formatString.js"

export function plotSingle(data, country, partner, timeRange, aggregation, categories, unit, width) {

    let dataFiltered;
    if (aggregation === "All products") {
        dataFiltered = data.filter(
            (d) =>
                d.country === country &&
                d.partner === partner &&
                d.category === "All products" &&
                d[unit] != null
        )
    } else {
        dataFiltered = data.filter(
            (d) =>
                d.country === country &&
                d.partner === partner &&
                d.category !== "All products" &&
                categories.includes(d.category) &&
                d[unit] != null
        )
    }

    const dataByYear = groupData(dataFiltered, ["year"], unit)

    return Plot.plot({
        width: width,
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
                    title: (d) => `${formatYear(d.year)} ${formatString(d.flow)}\n${d.category}\n${formatValue(d[unit]).label}${unit === "pct_gdp" ? " %" : " USD M"}`,
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
                title: (d) => `${formatYear(d.year)} Trade balance\n${formatValue(d.balance).label}${unit === "pct_gdp" ? " %" : " USD M"}`
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