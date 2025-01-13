import * as Inputs from "npm:@observablehq/inputs";
import {groupData} from "./groupData.js"
import {getLimits} from "./getLimits.js"
import {sparkbar} from "./sparkbar.js"
import {colorPalette} from "./colorPalette.js"
import {formatYear} from "./formatYear.js"
import {formatString} from "./formatString.js"

export function tableSingle(data, groupKey, unit, categories, width) {

    const filteredData = data.filter(
        (d) =>
            d.category !== "All products" &&
            categories.includes(d.category)
    );

    console.log("data:", filteredData)
    const tableData = groupData(filteredData, [groupKey], unit);

    const limits = getLimits(tableData); // Get min and max values for sparkbars
    const isYearTable = groupKey === "year";

    return Inputs.table(tableData, {
        sort: isYearTable ? "year" : "exports", // Sort by year or exports
        reverse: true, // Reverse sort only for category-based tables
        format: {
            [groupKey]: isYearTable ? (x) => formatYear(x) : (x) => x, // Format year or category
            imports: sparkbar(
                tableData,
                colorPalette.imports,
                "right",
                limits[0],
                limits[1]
            ),
            exports: sparkbar(
                tableData,
                colorPalette.exports,
                "left",
                limits[0],
                limits[1]
            ),
            balance: sparkbar(
                tableData,
                colorPalette.balance,
                "center",
                limits[0],
                limits[1]
            )
        },
        header: {
            ...Object.fromEntries(
                Object.keys(tableData[0]) // Get all columns
                    .map((key) => [
                        key,
                        formatString(key) // Call formatString for each key
                    ])
            )
        },
        align: {
            [groupKey]: "left",
            imports: "right",
            exports: "left",
            balance: "center"
        },
        width: width - 25
    });
}