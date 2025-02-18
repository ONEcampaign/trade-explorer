import * as Plot from "npm:@observablehq/plot";
import {utcYear} from "npm:d3-time";
import {timeFormat} from "npm:d3-time-format";
import {formatValue} from "./formatValue.js";
import {ONEPalette} from "./ONEPalette.js";
import {formatString} from "./formatString.js"
import {getUnitLabel} from "./getUnitLabel.js";

export function plotSingle(query, width) {

    let arrayData = query.toArray()
        .map((row) => ({
            ...row,
            year: new Date(row.year, 1, 1), // Ensure year is just the integer
        }))
    
    const isGDP = arrayData[0].unit === "share of gdp";
    const unit = isGDP ? "gdp" : arrayData[0].unit.split(" ")[1];

    arrayData = arrayData.reduce((acc, { year, imports, exports, balance, gdp }) => {
        // Initialize the accumulator for each year if not already initialized
        if (!acc[year]) {
            acc[year] = { year: year, exports: 0, imports: 0, balance: 0, gdp: 0 };
        }

        // Sum up exports, imports, balance, and gdp
        acc[year].exports += exports;
        acc[year].imports += imports;
        acc[year].balance += balance;
        acc[year].gdp = gdp; // Assuming GDP remains constant for the year

        return acc;
    }, {});

    // Convert the object into an array with the desired format
    const plotData = Object.values(arrayData)
        .flatMap(yearData => {
            const { year, exports, imports, balance, gdp } = yearData;
            const factor = isGDP && gdp ? (100 / gdp) : 1;

            return [
                { Year: year, Flow: 'exports', Value: exports * factor },
                { Year: year, Flow: 'imports', Value: imports * factor },
                { Year: year, Flow: 'balance', Value: balance * factor }
            ];
        })
        .sort((a, b) => a.Year - b.Year);

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
            label: getUnitLabel(unit, {}),
            tickSize: 0,
            ticks: 4,
            grid: true
        },
        color: {
            domain: ["imports", "exports", "balance"],
            range: [ONEPalette.teal, ONEPalette.orange, ONEPalette.burgundy]
        },
        marks: [

            // Imports/exports bars
            Plot.rectY(
                plotData.filter((d) => d.Flow !== 'balance'), {
                    x: "Year",
                    y: "Value",
                    fill: "Flow",
                    filter: d => d.balance !== 'balance',
                    opacity: .75
                }
            ),

            // Horizontal line at 0
            Plot.ruleY(
                [0], {
                    stroke: "black",
                    strokeWidth: .5
                }
            ),

            // Line for balance
            Plot.line(
                plotData.filter((d) => d.Flow === 'balance'), {
                    x: "Year",
                    y: "Value",
                    stroke: "Flow",
                    curve: "monotone-x",
                    strokeWidth: 2
                }
            ),

            Plot.tip(plotData,
                Plot.pointer({
                    x: "Year",
                    y: "Value",
                    fill: "Flow",
                    format: {
                        fill: (d) => formatString(d),
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