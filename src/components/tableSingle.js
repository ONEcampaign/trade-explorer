import * as Inputs from "npm:@observablehq/inputs";
import {getLimits} from "./getLimits.js";
import {sparkbar} from "./sparkbar.js";
import {ONEPalette} from "./ONEPalette.js";
import {formatString} from "./formatString.js";

export function tableSingle(query, width) {

    const arrayData = query.toArray()
        .map((row) => row.toJSON())

    const isGDP = arrayData[0].unit === "share of gdp";

    let tableData = Object.values(
        arrayData.reduce((acc, { category, imports, exports, balance, gdp }) => {
            if (!acc[category]) {
                acc[category] = { category, imports: 0, exports: 0, balance: 0, gdp: 0 };
            }

            acc[category].imports += imports;
            acc[category].exports += exports;
            acc[category].balance += balance;

            if (isGDP) {
                acc[category].gdp += gdp;
            }

            return acc;
        }, {})
    );


    tableData.forEach(entry => {
        if (isGDP) {
            entry.imports = (entry.imports / entry.gdp) * 100;
            entry.exports = (entry.exports / entry.gdp) * 100;
            entry.balance = (entry.balance / entry.gdp) * 100;
        }
        delete entry.gdp;
    });

    const limits = getLimits(tableData);

    return Inputs.table(tableData, {
        sort: "exports", // Sort by year or exports
        reverse: true, // Reverse sort only for category-based tables
        format: {
            year: (x) => x,
            imports: sparkbar(
                ONEPalette.teal,
                "right",
                limits[0],
                limits[1]
            ),
            exports: sparkbar(
                ONEPalette.orange,
                "left",
                limits[0],
                limits[1]
            ),
            balance: sparkbar(
                ONEPalette.burgundy,
                "center",
                limits[0],
                limits[1]
            )
        },
        header: {
            ...Object.fromEntries(
                Object.keys(tableData[0])
                    .map((key) => [
                        key,
                        formatString(key)
                    ])
            )
        },
        align: {
            year: "left",
            imports: "right",
            exports: "left",
            balance: "center"
        },
        width: width,
        height: width * .5
    });
}