import { multiPalette } from "./colors.js";
import {FileAttachment} from "observablehq:stdlib";
import {groupMappings} from "./inputValues.js";


export function formatString(str, {
    capitalize=true,
    inSentence=false,
    fileMode=false,
    genitive=false,
    verb=null
  }) {

  let result = str.includes("balance")
    ? str.replace("balance", "trade balance")
    : str;

  if (inSentence) {
    result = result
      .replace(/\bbalance\b/, "balance with")
      .replace(/\bexports\b/, "exports to")
      .replace(/\bimports\b/, "imports from");
  }

  if (capitalize) {
    result = result.charAt(0).toUpperCase() + result.slice(1);
  }

  if (fileMode) {
    result = result.toLowerCase().replace(/\s+/g, "_");
  }

  if (genitive) {
    result += result.endsWith("s") ? "'" : "'s";
  }

  if (verb) {
    result += " " + (result.endsWith("countries")
        ? verb.replace(/s$/, "")  // Remove trailing "s"
        : verb);  // Otherwise, use the original verb
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


export function generateTitle({
    country=null,
    partners=null,
    flow=null,
    mode
}) {

  const title = document.createElement("h2");
  title.className = "plot-title";

  if (mode === "plot") {
    if (partners.length === 1) {
      title.textContent = `${formatString(country, {genitive: true})} trade with ${partners[0]}`;
      title.innerHTML += partners.length === 1 && partners[0] === "the world" ? "<sup>*</sup>" : "";
    } else {
      title.textContent = `${formatString(country, {genitive: true})} ${formatString(flow, {capitalize: false})}`
    }
  }
  else if (mode === "table-top-partners") {
    if (flow === 'exports') {
      title.innerHTML = `${formatString(country, {genitive: true})} exports<sup>*</sup> go to ...`;
    }
    else {
      title.innerHTML = `${formatString(country, {genitive: true})} imports<sup>*</sup> come from ...`;
    }
  }
  else if (mode === "table-top-categories") {
    title.innerHTML = `${formatString(country, {verb: flow})}<sup>*</sup> a lot of ...`;
  }


  return title

}


export function generateSubtitle({
    partners=null,
    flow=null,
    category=null,
    timeRange=null,
    mode
}) {

  const subtitle = document.createElement("h3");
  subtitle.className = "plot-subtitle";

  const categoryString = category === "All" ? "All products" : category

  if (mode === "plot") {
    if (partners.length === 1) {

      subtitle.innerHTML = `
        <span class="export-label subtitle-label">Exports</span>, 
        <span class="import-label subtitle-label">imports</span> and 
        <span class="balance-label subtitle-label">trade balance</span>; 
        ${categoryString}
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

      subtitle.appendChild(document.createTextNode( `; ${categoryString}`));

    }
  }
  else {

    const timeString = timeRange[0] === timeRange[1] ? timeRange[0] : `${timeRange[0]}-${timeRange[1]}`

    if (mode === "table-top-partners") {
      subtitle.textContent = `${categoryString}; ${timeString}`;
    }
    else if (mode === "table-top-categories") {
      subtitle.textContent = `Product categories; ${timeString}`;
    }
    else if (mode === "table-multi") {
      subtitle.innerHTML = `By product category; ${timeString}`;
    }
  }

  return subtitle;

}


export async function generateFooter({
    unit=null,
    prices=null,
    country=null,
    flow = null,
    isMultiPartner=false,
    isGlobalTrade=false
}) {


  const footer = document.createElement("div");
  footer.className = "bottom-panel";

  const textSection = document.createElement("div");
  textSection.className = "text-section";
  textSection.appendChild(generateNote({ unit, prices, country, flow, isMultiPartner}));

  if (isGlobalTrade) {

    function groupLength(name) {
      return groupMappings[name].length;
    }

    const sampleInfo = await FileAttachment("../data/scripts/country_aggregates.csv").csv({typed: true});

    const NCountries = sampleInfo[0].n_countries
    const GDPShare = sampleInfo[0].gdp_share.toFixed(1)
    const PopulationShare = sampleInfo[0].pop_share.toFixed(1)

    const starNote = document.createElement("p");
    starNote.className = "plot-note";

    if (flow !== null) {
      starNote.textContent = `*This table includes ${formatString(country, {genitive: true})} ${formatString(flow, {inSentence: true, capitalize: false})} a selection of ${NCountries - groupLength(country)} countries, which altogether cover ${GDPShare}% of global GDP and ${PopulationShare}% of the world’s population.`
    } else  {
      starNote.textContent = `*This plot represents ${formatString(country, {genitive: true})} trade with a selection of ${NCountries - groupLength(country)} countries, which altogether cover ${GDPShare}% of global GDP and ${PopulationShare}% of the world’s population.`

    }

    textSection.appendChild(starNote);

  }

  const logoSection = document.createElement("div");
  logoSection.className = "logo-section";

  const link = document.createElement("a");
  link.href = "https://data.one.org/";
  link.target = "_blank";

  const ONELogo = await FileAttachment("../ONE-logo-black.png").image()


  link.appendChild(ONELogo);
  logoSection.appendChild(link);
  footer.appendChild(textSection);
  footer.appendChild(logoSection);

  return footer;
}


function generateNote({
    unit=null,
    prices=null,
    country=null,
    flow = null,
    isMultiPartner=false
}) {
  const note = document.createElement("p");
  note.className = "plot-note";

  let text = `
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

  if (isMultiPartner) {
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


export function generateFileName({
      country,
      partners,
      category,
      flow,
      timeRange,
      mode
    } ) {

  let text

  const timeString = timeRange[0] === timeRange[1] ? timeRange[0] : `${timeRange[0]}_${timeRange[1]}`
  const categoryString = category === 'All' ? '' : formatString(`_${category}`, { fileMode: true });

  if (mode === 'plot') {
    if (partners.length === 1) {
      text = `${formatString(country, {fileMode: true})}_trade_with_${formatString(partners[0], {fileMode: true})}_${timeString}${categoryString}`;
    }
    else {
      text = `${formatString(flow  + " " + country, {inSentence: true, capitalize: false, fileMode: true})}_${timeString}${categoryString}`;
      }
    }
  else if (mode === 'table-multi') {
    text = `trade_with_${formatString(country, {fileMode: true})}_${timeString}${categoryString}`;
    }
  else if (mode === 'table-partners') {
    if (flow === 'exports') {
      text = `${formatString(country, {fileMode: true})}_export_partners_${timeString}${categoryString}`;
    }
    else {
      text = `${formatString(country, {fileMode: true})}_import_partners_${timeString}${categoryString}`;
    }
  }
  else if (mode === 'table-categories') {
    text = `${formatString(country, {fileMode: true})}_top_${flow}_${timeString}`;
  }

  return text

}

