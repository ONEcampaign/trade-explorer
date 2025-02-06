import * as Plot from "npm:@observablehq/plot";
import {utcYear} from "npm:d3-time"
import {timeFormat} from "npm:d3-time-format"
import {formatValue} from "./formatValue.js";
import {jitterLabels} from "./jitterLabels.js";
import {getCurrencyLabel} from "./getCurrencyLabel.js";

export function plotMulti(query, flow, currency, width) {

    const arrayData = query.toArray()
        .map((row) => ({
            ...row,
            year: new Date(row.year, 1, 1)
        }))

    function groupData(data, flow) {
        return Object.values(
            data.reduce((acc, item) => {
                const Year = new Date(item.year);
                const Partner = item.partner;
                const key = `${Year}-${Partner}`;

                if (!acc[key]) {
                    acc[key] = { Year, Partner, [flow]: 0 };
                }
                acc[key].balance += item[flow];

                return acc;
            }, {})
        );
    }

    const plotData = groupData(arrayData, flow)
        .sort((a, b) => a.year - b.year);

    const formatYear = timeFormat("%Y");

    return Plot.plot({
        width: width,
        height: width * .5,
        marginTop: 25,
        marginRight: 75,
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
            label: getCurrencyLabel(currency, {}),
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
            Plot.line(plotData, {
                x: "Year",
                y: flow,
                z: "Partner",
                curve: "catmull-rom",
                stroke: "Partner",
                strokeWidth: 2
            }),

            // Country labels
            Plot.text(
                jitterLabels(
                    plotData,
                    flow,
                    "Year",
                    "Partner",
                ),
                {
                    x: "Year",
                    y: flow,
                    fill: "Partner",
                    text: "Partner",
                    fontSize: 12,
                    dx: 10,
                    frameAnchor: "left",
                    className: "country-label"
                }
            ),

            Plot.tip(plotData,
                Plot.pointer({
                    x: "Year",
                    y: flow,
                    fill: "Partner",
                    format: {
                        fill: true,
                        x: (d) => formatYear(d),
                        y: (d) => `${formatValue(d).label}`,
                        stroke: true
                    },
                    lineHeight: 1.25,
                    fontSize: 12
                })
            )


        ]
    })
}