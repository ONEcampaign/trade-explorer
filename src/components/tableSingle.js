import * as Inputs from "npm:@observablehq/inputs";
import { groupData } from "./groupData.js"
import { getLimits } from "./getLimits.js"
import { sparkbar } from "./sparkbar.js"
import { colorPalette } from "./colorPalette.js"
import { formatYear } from "./formatYear.js"
import { reactiveWidth } from "./reactiveWidth.js";

export function tableSingle(data, groupKey, country, partner, categories, unit, timeRange = null) {

  let dataFiltered = data.filter(
          (d) =>
              d.country == country &&
              d.partner == partner &&
              categories.includes(d.category) &&
              d[unit] != null
          )
  if (groupKey === "category") {
    dataFiltered = dataFiltered.filter((d) => d.year >= timeRange[0] && d.year <= timeRange[1])
  }

  const tableData = groupData(
          dataFiltered,
          [groupKey],
          unit
          )

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
        limits.min,
        limits.max
      ),
      exports: sparkbar(
        tableData,
        colorPalette.exports,
        "left",
        limits.min,
        limits.max
      ),
      balance: sparkbar(
        tableData,
        colorPalette.balance,
        "center",
        limits.min,
        limits.max
      )
    },
    header: {
      [groupKey]: isYearTable ? "Year" : "Category",
      imports: "Imports",
      exports: "Exports",
      balance: "Trade balance"
    },
    align: {
      [groupKey]: "left",
      imports: "right",
      exports: "left",
      balance: "center"
    },
    width: reactiveWidth - 50
  });
}