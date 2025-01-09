import {rollups, sum} from "npm:d3-array"

export function groupData(data, groupByColumns, unitColumn) {
    return rollups(
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
    )
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
}