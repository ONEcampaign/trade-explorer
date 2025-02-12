import * as Plot from "npm:@observablehq/plot";
import {utcYear} from "npm:d3-time"
import {timeFormat} from "npm:d3-time-format"
import {formatValue} from "./formatValue.js";
import {jitterLabels} from "./jitterLabels.js";
import {getUnitLabel} from "./getUnitLabel.js";

export function plotMulti(query, flow, width) {

    let arrayData = query.toArray()
        .map((row) => ({
            ...row,
            year: new Date(row.year, 1, 1)
        }))

    const isGDP = arrayData[0].unit === "share of gdp";
    const unit = isGDP ? "gdp" : arrayData[0].unit.split(" ")[1];

    arrayData = arrayData.reduce((acc, { year, partner, imports, exports, balance, gdp }) => {
        let key = `${year}||${partner}`; // Unique key for grouping by year-partner

        if (!acc[key]) {
            acc[key] = { year, partner, imports: 0, exports: 0, balance: 0, gdp: 0 };
        }

        acc[key][flow] += { imports, exports, balance }[flow];

        if (isGDP) {
            acc[key].gdp += gdp;
        }

        return acc;
    }, {});

    // Convert the object into an array with the desired format
    const plotData = Object.values(arrayData)
        .map(({ year, partner, imports, exports, balance, gdp }) => {
            let value = { imports, exports, balance }[flow];
            const factor = isGDP && gdp ? (100 / gdp) : 1;

            return {
                Year: year,
                Partner: partner,
                Flow: flow,
                Value: value * factor
            };
        })
        .sort((a, b) => a.Year - b.Year);

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
            label: getUnitLabel(unit, {}),
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
                y: "Value",
                z: "Partner",
                curve: "catmull-rom",
                stroke: "Partner",
                strokeWidth: 2
            }),

            // Country labels
            Plot.text(
                jitterLabels(
                    plotData,
                    "Value",
                    "Year",
                    "Partner",
                ),
                {
                    x: "Year",
                    y: "Value",
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
                    y: "Value",
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