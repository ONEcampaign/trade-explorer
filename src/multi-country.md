```js 
import { FileAttachment } from "observablehq:stdlib";
import { sortCategories } from "./components/sortCategories.js";
import { plotMulti } from "./components/plotMulti.js";
import { min, max } from "npm:d3-array";
import { tableMulti } from "./components/tableMulti.js";
import { colorPalette } from './components/colorPalette.js';
import { rangeInput } from "./components/rangeInput.js"
import { setCustomColors } from "./components/setCustomColors.js"
import { formatString } from "./components/formatString.js"
```

```js 
setCustomColors();
```

```js 
const tradeData = FileAttachment("./data/africa_trade_2002_2022.csv").csv({typed:true});
```

```js 
// Input options
const countries = Array.from(new Set(tradeData.map((d) => d.country))).filter((item) => item !== null && item !== "");
const partners = Array.from(new Set(tradeData.map((d) => d.partner))).filter((item) => item !== null && item !== "");
const categories = sortCategories(Array.from(new Set(tradeData.map((d) => d.category))).filter((item) => item !== null && item !== ""));
const timeRange = [min(tradeData, d => d.year), max(tradeData, d => d.year)];
```

```js
const firstLink = document.querySelector("li.observablehq-secondary-link a");

function updateFirstLinkText() {
  const flowString = formatString(flowInput.value, { inSentence: true })
  const partnerString = partnerInput.value === "United Kingdom"
  ? "the UK"
  : partnerInput.value === "USA"
    ? "the USA"
    : partnerInput.value;
  
  if (firstLink) {
    firstLink.textContent = flowString  + partnerString
  }
}

// Add event listeners to update text reactively
flowInput.addEventListener("input", updateFirstLinkText);
partnerInput.addEventListener("input", updateFirstLinkText);

// Initial call to set the text content on page load
updateFirstLinkText();
```

```js
// Country Input
const countryInput = Inputs.select(
  Array.from(new Set(tradeData.map((d) => d.country))),
  {
    label: "Select countries",
    sort: true,
    multiple: true,
    value: [
      "South Africa",
      "Kenya",
      "Nigeria",
      "Senegal",
      "Côte d'Ivoire"
      // "Ghana"
      // "Ethiopia"
      // "Zambia"
      // "Uganda"
      // "Dem. Rep. of the Congo"
    ]
  }
)
const countryMulti = Generators.input(countryInput);

// Partner Input
const partnerInput = Inputs.select(
  partners,
  { label: "Select partner", sort: true }
)
const partnerMulti = Generators.input(partnerInput)

// Select all input
const SelectAllInput = Inputs.toggle({
  label: "Select all",
  value: true
});

// Time Input
const timeRangeInput = rangeInput({
  min: timeRange[0],
  max: timeRange[1],
  step: 1,
  value: [2012, 2022],
  label: "Adjust time range",
  color: colorPalette.inputTheme,
  enableTextInput: true
})
const timeRangeMulti = Generators.input(timeRangeInput)

// Categories Input
const categoriesInput = Inputs.checkbox(categories, {
  label: "Select product categories",
  value: SelectAllInput.value ? categories : []
});
const categoriesMulti = Generators.input(categoriesInput);

// Reactive behavior to update categoriesInput and trigger categoriesMulti when SelectAllInput changes
SelectAllInput.addEventListener("input", () => {
  categoriesInput.value = SelectAllInput.value ? categories : [];
  
  // Manually dispatch an input event to trigger categoriesMulti update
  categoriesInput.dispatchEvent(new Event("input"));
});

// Unit input
const unitInput = Inputs.radio(
  new Map([
    ["Percentage of GDP", "pct_gdp"],
    ["Constant USD", "constant_usd_2015"],
    ["Current USD", "current_usd"]
  ]),
  {
    label: "Select unit",
    value: "pct_gdp"
  }
)
const unitMulti = Generators.input(unitInput)

// Flow input
const flowInput = Inputs.radio(
  new Map([
    ["Trade balance", "balance"],
    ["Exports", "exports"],
    ["Imports", "imports"]
  ]),
  {
    label: "Select flow",
    value: "balance"
  }
)
const flowMulti = Generators.input(flowInput)
```

<h1 class="header">
    Multi Country
</h1>

<p class="normal-text">
    Choose multiple African countries from the list below by dragging or Shift-clicking, and select or deselect a country by Command-clicking. Next, select a trading partner (ONE market) and a trade flow (trade balance, exports, imports). You can also adjust the time range, the product categories of traded goods and the unit of currency for the data shown.
</p>

<p class="normal-text">
    <a href="#trade-plot">This plot</a> contains a line for each african country showing the selected trade flow with the indicated trade partner.
</p>

<p class="normal-text">
    <a href="#trade-by-year">This table</a> shows the figures included in the plot, whereas <a href="#trade-by-category">this one</a> presents trade data aggregated by product categories.
</p>

<br>

<div class="card" style="display: grid; gap: 0.5rem;">
  <div>${countryInput}</div>
  <div>${partnerInput}</div>
  <div>${flowInput}</div>
  <div>${timeRangeInput}</div>
  <div>${categoriesInput}</div>
  <div>${SelectAllInput}</div>
  <div>${unitInput}</div>
</div>

<br>
<br>

<div class="viz-container">
    <div class="top-panel">
        <h2 class="plot-title" id="trade-plot"> 
            ${formatString(flowMulti, { inSentence: true })}${partnerMulti}
        </h2>
        <h3 class="plot-subtitle">
            Selected African countries
        </h3>
    </div>
    <div>
        ${plotMulti(tradeData, countryMulti, partnerMulti, timeRangeMulti, categoriesMulti, unitMulti, flowMulti)}
    </div>
    <div class="bottom-panel">
      <div class="text-section">
        <p class="plot-source">
            Source: Gaulier and Zignago (2010) 
            <a href="https://cepii.fr/CEPII/en/bdd_modele/bdd_modele_item.asp?id=37" target="_blank" rel="noopener noreferrer">
                BACI: International Trade Database at the Product-Level
            </a>
            . CEPII
        </p>
      </div>
      <div class="logo-section">
        <img src="ONE-logo-black.png"/>
      </div>
    </div>
</div>

<br>
<br>

<div class="viz-container">
    <div class="top-panel">
        <h2 class="section-header" id="trade-by-category">
            Trade by category
        </h2>
        <p class="normal-text">
            Total value of 
            <span class="bold-text">${flowMulti === "balance" ? "trade balance with " : flowMulti === "imports" ? "Imports from " : "Exports to "}</span> 
            <span class="bold-text">${partnerMulti}</span> for each category of traded goods in 
            <span class="bold-text">${timeRangeMulti[0]}-${timeRangeMulti[1]}</span>.
        </p>
    </div>
    <div>
        ${tableMulti(tradeData, "category", countryMulti, partnerMulti, categoriesMulti, unitMulti, flowMulti, timeRangeMulti)}
    </div>
    <div class="bottom-panel">
      <div class="text-section">
        <p class="plot-source">
            Source: Gaulier and Zignago (2010) 
            <a href="https://cepii.fr/CEPII/en/bdd_modele/bdd_modele_item.asp?id=37" target="_blank" rel="noopener noreferrer">
                BACI: International Trade Database at the Product-Level
            </a>
            . CEPII
        </p>
        <p class="plot-note">All values ${unitMulti === "pct_gdp" ? "as percentage of GDP" : unitMulti === "constant_usd_2015" ? "in million constant 2015 USD" : "in million current USD"}.</p>
      </div>
      <div class="logo-section">
        <img src="ONE-logo-black.png"/>
      </div>
    </div>
</div>

<br>
<br>

<div class="viz-container">
    <div class="top-panel">
        <h2 class="section-header" id="trade-by-year">
            Trade by year
        </h2>
        ${
            categoriesMulti.length === categories.length
            ? html`<p class="normal-text">Total yearly value of <span class="bold-text">${flowMulti === "balance" ? "trade balance with " : flowMulti === "imports" ? "Imports from " : "Exports to "}${partnerMulti}</span> including <span class="bold-text">all product categories</span>.</p>`
            : html`<p class="normal-text">Total yearly value of <span class="bold-text">${flowMulti === "balance" ? "trade balance with " : flowMulti === "imports" ? "Imports from " : "Exports to "}${partnerMulti}</span> including the following product categories:</p><ul>${categoriesMulti.map((item) => html`<li>${item}</li>`)}</ul><br>`
        }
    </div>
    <div>
        ${tableMulti(tradeData, "year", countryMulti, partnerMulti, categoriesMulti, unitMulti, flowMulti, timeRangeMulti)}
    </div>
    <div class="bottom-panel">
      <div class="text-section">
        <p class="plot-source">
            Source: Gaulier and Zignago (2010) 
            <a href="https://cepii.fr/CEPII/en/bdd_modele/bdd_modele_item.asp?id=37" target="_blank" rel="noopener noreferrer">
                BACI: International Trade Database at the Product-Level
            </a>
            . CEPII
        </p>
        <p class="plot-note">All values ${unitMulti === "pct_gdp" ? "as percentage of GDP" : unitMulti === "constant_usd_2015" ? "in million constant 2015 USD" : "in million current USD"}.</p>
      </div>
      <div class="logo-section">
        <img src="ONE-logo-black.png"/>
      </div>
    </div>
</div>