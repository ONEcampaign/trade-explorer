import * as Inputs from "npm:@observablehq/inputs";
import {schemeObservable10} from "npm:d3-scale-chromatic"
import {sortCategories} from "./sortCategories.js"
import {groupData} from "./groupData.js"
import {reshapeDataForTable} from "./reshapeDataForTable.js"
import {getLimits} from "./getLimits.js"
import {sparkbar} from "./sparkbar.js"
import {formatString} from "./formatString.js"

export function tableMulti(data, groupKey, country, partner, categories, unit, flow, timeRange = null, width) {

    let dataFiltered = data.filter(
        (d) =>
            country.includes(d.country) &&
            d.partner === partner &&
            d.category !== "All products" &&
            categories.includes(d.category) &&
            d[unit] != null
    )

    if (groupKey === "category") {
        dataFiltered = dataFiltered.filter((d) => d.year >= timeRange[0] && d.year <= timeRange[1])
    }

    const groupedData = groupData(
        dataFiltered,
        [groupKey, "country"],
        unit
    )

    let tableData;
    if (groupKey === "category") {
        tableData = sortCategories(reshapeDataForTable(groupedData, flow), groupKey);
    } else {
        tableData = reshapeDataForTable(groupedData, flow);
    }

    const limits = getLimits(tableData); // Get min and max values for sparkbars

    // Capitalize groupKey for header label

    const colors = schemeObservable10;


    return Inputs.table(tableData, {
        sort: groupKey === "year" ? "year" : undefined, // Sort by year if grouping by year
        reverse: groupKey === "year",
        format: {
            [groupKey]: (x) => x, // General formatter for groupKey (year or category)
            ...Object.fromEntries(
                Object.keys(tableData[0]) // Get all columns
                    .filter((key) => key !== groupKey) // Exclude the grouping key (year or category)
                    .map((key, index) => [
                        key,
                        sparkbar(
                            tableData,
                            colors[index % colors.length], // Cycle through colors
                            "center",
                            limits.min,
                            limits.max
                        )
                    ])
            )
        },
        header: {
            [groupKey]: formatString(groupKey)
        },
        align: {
            [groupKey]: "left"
        },
        width: width - 25
    });
}