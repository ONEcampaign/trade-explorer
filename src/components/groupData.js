import { rollups, sum } from "npm:d3-array";

export function groupData(data, groupByColumns, unitColumn) {
    // Group the data by the specified columns and sum up imports and exports
    const groupedData = rollups(
        data,
        (v) => ({
            imports: sum(
                v.filter((d) => d.flow === "imports"),
                (d) => d[unitColumn]
            ),
            exports: sum(
                v.filter((d) => d.flow === "exports"),
                (d) => d[unitColumn]
            )
        }),
        ...groupByColumns.map((col) => (d) => d[col]) // Dynamically group by specified columns
    );

    // Map the grouped data to a more readable format
    const mappedData = groupedData
        .map((group) => {
            if (groupByColumns.length === 1) {
                // Single-level grouping (year or category)
                const [key, values] = group;
                return {
                    [groupByColumns[0]]: key,
                    imports: values.imports,
                    exports: values.exports,
                    balance: values.exports + values.imports
                };
            } else {
                // Two-level grouping (year and category)
                const [firstKey, secondGroups] = group;
                return secondGroups.map(([secondKey, values]) => ({
                    [groupByColumns[0]]: firstKey,
                    [groupByColumns[1]]: secondKey,
                    imports: values.imports,
                    exports: values.exports,
                    balance: values.exports + values.imports
                }));
            }
        })
        .flat(); // Flatten if two-level grouping

    // Sort the data by groupByColumns
    return mappedData.sort((a, b) => {
        for (let i = 0; i < groupByColumns.length; i++) {
            // Compare values of the current column
            const col = groupByColumns[i];
            if (a[col] < b[col]) return -1; // If a is less than b, return -1
            if (a[col] > b[col]) return 1;  // If a is greater than b, return 1
        }
        return 0; // If they are equal, return 0
    });
}
