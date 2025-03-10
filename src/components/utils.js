import { multiPalette } from "./colors.js";


export function formatString(
  str,
  options = {
    capitalize: true,
    inSentence: false,
    fileMode: false,
    genitive: false,
    verb: null
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

  if (options.capitalize) {
    result = result.charAt(0).toUpperCase() + result.slice(1);
  }

  if (options.fileMode) {
    result = result.toLowerCase().replace(/\s+/g, "_");
  }

  if (options.genitive) {
    result += result.endsWith("s") ? "'" : "'s";
  }

  if (options.verb) {
    result += " " + (result.endsWith("countries")
        ? options.verb.replace(/s$/, "")  // Remove trailing "s"
        : options.verb);  // Otherwise, use the original verb
  }

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
  let hasNumericValue = false; // Track if any numeric value is found

  data.forEach((row) => {
    Object.keys(row).forEach((key) => {
      if (typeof row[key] === "number") {
        // Process only numeric values
        minValue = Math.min(minValue, row[key]);
        maxValue = Math.max(maxValue, row[key]);
        hasNumericValue = true;
      }
    });
  });

  return hasNumericValue ? [minValue, maxValue] : [null, null]; // Return null if no numeric values exist
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


export function generateTitleSingle(country, flow, {plot= true}) {

  const title = document.createElement("h2");
  title.className = "plot-title";

  if (plot) {
    if (flow === 'exports') {
      title.textContent = `${formatString(country, {genitive: true})} exports go to ...`;
    }
    else {
      title.textContent = `${formatString(country, {genitive: true})} imports come from ...`;
    }
  }
  else {
      title.textContent = `${formatString(country, {verb: flow})} a lot of ...`;
  }

  return title;

}


export function generatePlotTitle(country, partners, flow) {

  const title = document.createElement("h2");
  title.className = "plot-title";

  if (partners.length === 0) {
    return ""
  }
  else if  (partners.length === 1) {
    title.textContent = `${formatString(country, {genitive: true})} trade with ${partners}`;
  }
  else {
    title.textContent = `${formatString(country, {genitive: true})} ${formatString(flow, {capitalize: false})}`
  }

  return title;

}


export function generateSubtitle(partners, flow, timeRange, {table=false}) {

  const subtitle = document.createElement("h3");
  subtitle.className = "plot-subtitle";

    if (partners.length === 0) {
      return subtitle;
    }
    else {
      if (table) {
        subtitle.innerHTML = `By product category, ${timeRange[0] === timeRange[1] ? timeRange[0] :
            `${timeRange[0]}-${timeRange[1]}`}`
      }
      else if (partners.length === 1) {

        subtitle.innerHTML = `
          <span class="export-label subtitle-label">Exports</span>, 
          <span class="import-label subtitle-label">imports</span> and 
          <span class="balance-label subtitle-label">trade balance</span>
      `

      } else {

        const colors = multiPalette;

        // Determine prefix based on flow
        const prefix = flow === "exports" ? "To " : flow === "imports" ? "From " : "With ";

        // Create and append the prefix text
        subtitle.appendChild(document.createTextNode(prefix));

        partners.sort();
        partners.forEach((text, index) => {
          const span = document.createElement("span");
          span.className = "subtitle-label";
          span.textContent = text;
          span.style.color = colors[index % colors.length]; // Cycle through colors

          subtitle.appendChild(span);

          // Add appropriate separator
          if (index < partners.length - 2) {
            subtitle.appendChild(document.createTextNode(", "));
          } else if (index === partners.length - 2) {
            subtitle.appendChild(document.createTextNode(" and "));
          }
        });

      }
    }

  return subtitle;

}


export function generateNote(unit, prices, country, isMultiPartner, flow=null) {

  const note = document.createElement("p");
  note.className = "plot-note";

  let text =`
        Source: <a 
        href="https://cepii.fr/CEPII/en/bdd_modele/bdd_modele_item.asp?id=37" 
        target="_blank"
        rel="noopener noreferrer">BACI: International trade database at the Product-level</a>.
        CEPII. •
    `;

  // GDP-specific note
  if (unit === "gdp") {
    text += `<span>All values as a share of ${formatString(country, { genitive: true })} GDP.</span>`;
  } else {
    // Prices (constant vs. current)
    const unitLabel = getUnitLabel(unit, {});
    text += `<span>All values in ${prices === "constant" ? "constant 2023" : "current"} ${unitLabel}.</span>`;
  }

  if  (isMultiPartner) {
    if (flow === "exports") {
      text += `<span> Exports refer to the value of goods traded from ${country} to selected partners.</span>`;
    } else if (flow === "imports") {
      text += `<span> Imports refer to the value of goods traded from selected partners to ${country}.</span>`;
    } else {
      text += `<span> A positive trade balance indicates that ${formatString(country, { genitive: true })} exports to a partner exceed its imports from that partner.</span>`;
    }
  }

  note.innerHTML = text.trim(); // Trim any trailing spaces

  return note;
}

export function generateFileName(country, timeRange, partners, flow, {png= false}) {

  let text

  if (partners.length === 1) {
      text = `trade_between_${formatString(country, {fileMode: true})}_and_${formatString(partners[0], {fileMode: true})}_${timeRange[0]}_${timeRange[1]}`;
  }
  else {
    if (png) {
      text = `${formatString(flow  + " " + country, {inSentence: true, capitalize: false, fileMode: true})}_${timeRange[0]}_${timeRange[1]}`;
    }
    else {
      text = `trade_with_${formatString(country, {fileMode: true})}_${timeRange[0]}_${timeRange[1]}`;
    }
  }

  return text

}

