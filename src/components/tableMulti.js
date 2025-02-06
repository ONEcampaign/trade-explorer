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

    function groupData(data, flow) {
        return Object.values(
            data.reduce((acc, item) => {
                const category = item.category;
                const partner = item.partner;
                const key = `${category}-${partner}`;

                if (!acc[key]) {
                    acc[key] = { category, partner, [flow]: 0 };
                }
                acc[key].balance += item[flow];

                return acc;
            }, {})
        );
    }

    const groupedData = groupData(arrayData, flow)

    console.log(groupedData);

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