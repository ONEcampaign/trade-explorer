import * as Plot from "npm:@observablehq/plot";
import {groupData} from "./groupData.js";
import {xDomain} from "./xDomain.js";
import {yDomain} from "./yDomain.js";
import {formatYear} from "./formatYear.js";
import {formatValue} from "./formatValue.js";
import {jitterLabels} from "./jitterLabels.js";
import {formatString} from "./formatString.js";
import {getLimits} from "./getLimits.js";

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

    const groupedData = groupData(filteredData, ["year", "country"], unit)

    return Plot.plot({
        width: width,
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
                r: 1,
                fill: "country",
                title: (d) => `${d.country}, ${d.year}\n${formatString(flow)}: ${formatValue(d[flow]).label}${unit === "pct_gdp" ? " %" : " USD M"}`,
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