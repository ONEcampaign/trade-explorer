import * as Plot from "npm:@observablehq/plot";
import {groupData} from "./groupData.js";
import {xDomain} from "./xDomain.js";
import {yDomain} from "./yDomain.js";
import {formatYear} from "./formatYear.js";
import {formatValue} from "./formatValue.js";
import {colorPalette} from "./colorPalette.js";
import {formatString} from "./formatString.js"

export function plotSingle(data, country, partner, timeRange, aggregation, categories, unit, width) {

    let plotData = data.filter(
        (d) =>
            d.country === country &&
            d.partner === partner &&
            d.year >= timeRange[0] &&
            d.year <= timeRange[1] &&
            d[unit] != null
    );

    if (aggregation === "All products") {
        plotData = plotData.filter((d) => d.category === "All products");
    } else {
        plotData = plotData.filter((d) => categories.includes(d.category));
    }

    const dataByYear = groupData(plotData, ["year"], unit)

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
                plotData, {
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
                plotData,
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

            // // Points for balance
            // Plot.dot(dataByYear, {
            //     x: "year",
            //     y: "balance",
            //     fill: colorPalette.balance,
            //     stroke: colorPalette.balance,
            //     strokeWidth: 3,
            //     title: (d) => `${formatYear(d.year)} Trade balance\n${formatValue(d.balance).label}${unit === "pct_gdp" ? " %" : " USD M"}`
            // })
        ]
    })
}