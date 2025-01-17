import * as Plot from "npm:@observablehq/plot";
import {utcYear} from "npm:d3-time"
import {timeFormat} from "npm:d3-time-format"
import {groupData} from "./groupData.js";
import {formatValue} from "./formatValue.js";
import {jitterLabels} from "./jitterLabels.js";
import {formatString} from "./formatString.js";

export function plotMulti(data, countries, partner, flow, timeRange, aggregation, categories, unit, width) {

    let filteredData = data.filter(
        (d) =>
            countries.includes(d.country) &&
            d.partner === partner &&
            d.year >= timeRange[0] &&
            d.year <= timeRange[1] &&
            d[unit] != null
    );

    if (aggregation === "All products") {
        filteredData = filteredData.filter((d) => d.category === "All products");
    } else {
        filteredData = filteredData.filter((d) => categories.includes(d.category));
    }

    const groupedData = groupData(filteredData, ["date", "country"], unit)

    // const parseDate = timeParse("%Y");
    const formatYear = timeFormat("%Y");

    return Plot.plot({
        width: width,
        height: width * .5,
        marginTop: 25,
        marginRight: 100,
        marginBottom: 25,
        marginLeft: 40,
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
                x: "date",
                y: flow,
                z: "country",
                curve: "catmull-rom",
                stroke: "country",
                strokeWidth: 2
            }),

            // Dots for each point
            Plot.dot(groupedData, {
                x: "date",
                y: flow,
                z: "country",
                r: 1,
                fill: "country",
                title: (d) => `${d.country}, ${formatYear(d.date)}\n${formatString(flow)}: ${formatValue(d[flow]).label}${unit === "pct_gdp" ? " %" : " USD M"}`,
                tip: true
            }),

            // Country labels
            Plot.text(
                jitterLabels(
                    groupedData,
                    flow
                ),
                {
                    x: "date",
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