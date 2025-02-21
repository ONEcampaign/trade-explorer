import { multiPalette } from "./colors.js";


export function formatString(
  str,
  options = {
    capitalize: true,
    inSentence: false,
    fileMode: false,
    genitive: false,
  },
) {
  let result = str.includes("balance")
    ? str.replace("balance", "trade balance")
    : str;

  if (options.inSentence) {
    result = result
      .replace(/\bbalance\b/, "balance with")
      .replace(/\bexports\b/, "exports from")
      .replace(/\bimports\b/, "imports to");
  }

  if (options.capitalize && !options.fileMode) {
    result = result.charAt(0).toUpperCase() + result.slice(1);
  }

  if (options.fileMode) {
    result = result.toLowerCase().replace(/\s+/g, "_");
  }

  console.log(result)

  if (options.genitive) {
    result += result.endsWith("s") ? "'" : "'s";
  }

  console.log(result)

  return result;
}


export function formatValue(value) {
  // Handle null values
  if (value == null) {
    return { value: 0, label: "0" };
  }

  // Round to two decimal places for the value
  const roundedValue = parseFloat(value.toFixed(2));

  // Determine the label
  let label;
  if (value === 0) {
    label = "0";
  } else if (value > -0.01 && value < 0.01) {
    if (value > -0.01) {
      label = "> -0.01";
    } else {
      label = "< 0.01";
    }
  } else {
    label = roundedValue.toLocaleString("en-US", {
      minimumFractionDigits: 1,
      maximumFractionDigits: 2,
    });
  }

  // Return both rounded value and label
  return { value: roundedValue, label };
}


export function getLimits(data) {
  let minValue = Infinity;
  let maxValue = -Infinity;

  data.forEach((row) => {
    Object.keys(row).forEach((key) => {
      if (key !== "year" && key !== "category" && row[key] != null) {
        // Skip 'year' and null/undefined values
        minValue = Math.min(minValue, row[key]);
        maxValue = Math.max(maxValue, row[key]);
      }
    });
  });

  return [minValue, maxValue];
}


export function getUnitLabel(unit, { long = true, value = "" }) {
  let prefix, suffix;

  if (unit === "gdp") {
    prefix = "";
    suffix = "% of GDP";
  } else {
    if (long) {
      suffix = "Million";
    } else suffix = "M";

    if (unit === "usd") {
      prefix = "US$";
    } else if (unit === "eur") {
      prefix = "€";
    } else if (unit === "cad") {
      prefix = "CA$";
    } else if (unit === "gbp") {
      prefix = "£";
    }
  }

  if (value === "") {
    return `${prefix} ${suffix}`;
  } else {
    return `${prefix}${value} ${suffix}`;
  }
}


export function reshapeDataForTable(data, flow, groupKey) {
  // Extract unique group keys (years or categories) and countries
  const groupKeys = [...new Set(data.map((d) => d[groupKey]))].sort();
  const countries = [...new Set(data.map((d) => d.partner))].sort();

  // Create an array of objects where each object represents a row for a specific group key
  const reshapedData = groupKeys.map((key) => {
    const row = { [groupKey]: key };
    countries.forEach((partner) => {
      const record = data.find(
        (d) => d[groupKey] === key && d.partner === partner,
      );
      row[partner] = record ? record[flow] : null; // Use null if no data is available
    });
    return row;
  });

  return reshapedData;
}


export function generateSubtitle(strings) {
  const colors = multiPalette;
  const subtitle = document.createElement("h3");
  subtitle.className = "plot-subtitle";

  // Sort strings alphabetically
  strings.sort();

  strings.forEach((text, index) => {
    const span = document.createElement("span");
    span.className = "subtitle-label";
    span.textContent = text;
    span.style.color = colors[index % colors.length]; // Cycle through colors

    subtitle.appendChild(span);

    // Add appropriate separator
    if (index < strings.length - 2) {
      subtitle.appendChild(document.createTextNode(", "));
    } else if (index === strings.length - 2) {
      subtitle.appendChild(document.createTextNode(" and "));
    }
  });

  return subtitle;
}
