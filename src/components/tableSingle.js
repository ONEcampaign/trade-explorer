import * as Inputs from "npm:@observablehq/inputs";
import {groupData} from "./groupData.js"
import {getLimits} from "./getLimits.js"
import {sparkbar} from "./sparkbar.js"
import {colorPalette} from "./colorPalette.js"
import {formatString} from "./formatString.js"

export function tableSingle(data, country, partner, timeRange, aggregation, categories, unit, groupKey, width) {

    const isYearTable = groupKey === "year";

    let filteredData = data.filter(
        (d) =>
            d.country === country &&
            d.partner === partner &&
            d[unit] != null
    );

    if (isYearTable) {
        if  (aggregation === "All products") {
            filteredData = filteredData.filter((d) => d.category === "All products")
        } else {
            filteredData = filteredData.filter((d) => categories.includes(d.category))
        }
    } else  {
        filteredData = filteredData.filter(
            (d) =>
                d.year >= timeRange[0] &&
                d.year <= timeRange[1] &&
                d.category !== "All products"
        )
    }

    const tableData = groupData(filteredData, [groupKey], unit);

    const limits = getLimits(tableData); // Get min and max values for sparkbars

    return Inputs.table(tableData, {
        sort: isYearTable ? "year" : "exports", // Sort by year or exports
        reverse: true, // Reverse sort only for category-based tables
        format: {
            [groupKey]: (x) => x,
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