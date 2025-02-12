import * as Inputs from "npm:@observablehq/inputs";
import {schemeObservable10} from "npm:d3-scale-chromatic";
import {reshapeDataForTable} from "./reshapeDataForTable.js";
import {getLimits} from "./getLimits.js";
import {sparkbar} from "./sparkbar.js";
import {formatString} from "./formatString.js";

export function tableMulti(query, flow, width) {

    const arrayData = query.toArray()
        .map((row) => ({
            ...row,
            year: new Date(row.year, 1, 1)
        }))

    const isGDP = arrayData[0].unit === "share of gdp";

    let groupedData = Object.values(
        arrayData.reduce((acc, { category, partner, imports, exports, balance, gdp }) => {
            let key = `${category}||${partner}`; // Unique key for category-partner grouping

            if (!acc[key]) {
                acc[key] = { category, partner, imports: 0, exports: 0, balance: 0, gdp: 0 };
            }

            acc[key][flow] += { imports, exports, balance }[flow];

            if (isGDP) {
                acc[key].gdp += gdp;
            }

            return acc;
        }, {})
    );

    groupedData.forEach(entry => {
        if (isGDP) {
            entry[flow] = (entry[flow] / entry.gdp) * 100;
        }
        delete entry.gdp;
    });


    const tableData = reshapeDataForTable(groupedData, flow, "category");

    const limits = getLimits(tableData);

    const colors = schemeObservable10;

    return Inputs.table(tableData, {
        format: {
            category: (x) => x, // General formatter for groupKey (year or category)
            ...Object.fromEntries(
                Object.keys(tableData[0]) // Get all columns
                    .filter((key) => key !== "category") // Exclude the grouping key (year or category)
                    .map((key, index) => [
                        key,
                        sparkbar(
                            colors[index % colors.length], // Cycle through colors
                            "center",
                            limits[0],
                            limits[1]
                        )
                    ])
            )
        },
        header: {
            category: formatString("category")
        },
        align: {
            category: "left"
        },
        width: width,
        height: width * .5
    });
}