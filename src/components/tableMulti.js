import * as Inputs from "npm:@observablehq/inputs";
import {schemeObservable10} from "npm:d3-scale-chromatic";
import {groupData} from "./groupData.js";
import {reshapeDataForTable} from "./reshapeDataForTable.js";
import {getLimits} from "./getLimits.js";
import {sparkbar} from "./sparkbar.js";
import {formatString} from "./formatString.js";

export function tableMulti(query, width) {

    const arrayData = query.toArray()
        .map((row) => ({
            ...row,
            year: new Date(row.year, 1, 1)
        }))

    const columns = Object.keys(arrayData[0]);
    const nonValueColumns = ['year', 'country', 'category'];
    const flow = columns.find(col => !nonValueColumns.includes(col));

    // Grouping and summing logic, with the dynamic value column
    const groupedData = arrayData.reduce((acc, { category, country, [flow]: value }) => {
        const key = `${category}-${country}`;

        if (!acc[key]) {
            acc[key] = { category, country, [flow]: 0 };
        }

        acc[key][flow] += value;

        return acc;
    }, {});

    const arrayGroupedData = Object.values(groupedData)
        .sort((a, b) => a.year - b.year);

    const tableData = reshapeDataForTable(arrayGroupedData, flow, "category");

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