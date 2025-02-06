import * as Plot from "npm:@observablehq/plot";
import {utcYear} from "npm:d3-time"
import {timeFormat} from "npm:d3-time-format"
import {formatValue} from "./formatValue.js";
import {jitterLabels} from "./jitterLabels.js";
import {formatString} from "./formatString.js";
import {groupData} from "./groupData.js";
import {getCurrencyLabel} from "./getCurrencyLabel.js";

export function plotMulti(query, currency, width) {

    const arrayData = query.toArray()
        .map((row) => ({
            ...row,
            year: new Date(row.year, 1, 1)
        }))

    const columns = Object.keys(arrayData[0]);
    const nonValueColumns = ['year', 'country', 'category'];
    const flow = columns.find(col => !nonValueColumns.includes(col));

    // Grouping and summing logic, with the dynamic value column
    const groupedData = arrayData.reduce((acc, { year, country, [flow]: value }) => {
        const key = `${year.getFullYear()}-${country}`;

        if (!acc[key]) {
            acc[key] = { year, country, [flow]: 0 };
        }

        acc[key][flow] += value;

        return acc;
    }, {});

    const plotData = Object.values(groupedData)
        .sort((a, b) => a.year - b.year)
        .map(item => ({
            Year: item.year,
            Country: item.country,
            [flow]: item[flow],
        }));

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
                z: "Country",
                curve: "catmull-rom",
                stroke: "Country",
                strokeWidth: 2
            }),

            // Country labels
            Plot.text(
                jitterLabels(
                    plotData,
                    flow,
                    "Year",
                    "Country"
                ),
                {
                    x: "Year",
                    y: flow,
                    fill: "Country",
                    text: "Country",
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
                    fill: "Country",
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