import * as Plot from "npm:@observablehq/plot";
import {utcYear} from "npm:d3-time"
import {timeFormat} from "npm:d3-time-format"
import {groupData} from "./groupData.js";
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

    const dataByYear = groupData(plotData, ["date"], unit)

    const formatYear = timeFormat("%Y")

    return Plot.plot({
        width: width,
        height: width * .5,
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
            label: unit === "pct_gdp" ? "% GDP" : "Million USD",
            tickSize: 0,
            ticks: 4,
            grid: true
        },
        color: {
            domain: ["imports", "exports"],
            range: [colorPalette.imports, colorPalette.exports]
        },
        marks: [

            // Bars for imports and exports
            Plot.rectY(
                plotData, {
                    x: "date",
                    y: unit,
                    fill: "flow",
                    title: (d) => `${formatYear(d.date)} ${formatString(d.flow)}\n${d.category}\n${formatValue(d[unit]).label}${unit === "pct_gdp" ? " %" : " USD M"}`,
                    tip: true,
                    opacity: .6
                }
            ),

            // reactivity
            Plot.rectY(
                plotData,
                Plot.pointer({
                    x: "date",
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
                x: "date",
                y: "balance",
                curve: "catmull-rom",
                stroke: colorPalette.balance,
                strokeWidth: 2
            })
        ]
    })
}