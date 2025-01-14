```js 
import {FileAttachment} from "observablehq:stdlib";
import {sortCountries} from "./components/sortCountries.js";
import {sortCategories} from "./components/sortCategories.js";
import {plotMulti} from "./components/plotMulti.js";
import {min, max} from "npm:d3-array";
import {tableMulti} from "./components/tableMulti.js";
import {colorPalette} from './components/colorPalette.js';
import {rangeInput} from "./components/rangeInput.js";
import {multiSelect} from "./components/multiSelect.js";
import {setCustomColors} from "./components/setCustomColors.js";
import {formatString} from "./components/formatString.js";
import {downloadPNG} from './components/downloadPNG.js';
import {downloadXLSX} from "./components/downloadXLSX.js";
```

```js
setCustomColors();
```

```js
const rawData = await FileAttachment("./data/africa_trade.parquet").parquet();
const tradeData = rawData.toArray()
    .map((d) => ({...d,year: Number(d.year)}));
```

```js
// Input options
const countries = sortCountries(Array.from(new Set(tradeData.map((d) => d.country))));
const partners = Array.from(new Set(tradeData.map((d) => d.partner)));
const categories = sortCategories(
    Array.from(new Set(tradeData.map((d) => d.category)))
        .filter((item) => item !== "All products")
);
const timeRange = [min(tradeData, (d) => d.year), max(tradeData, (d) => d.year)];
```

```js
const oneLogo = FileAttachment("./ONE-logo-black.png").href;
```

```js
// Remane plot link in toc
const firstLink = document.querySelector("li.observablehq-secondary-link a");

function updateFirstLinkText() {
    const flowString = formatString(flowInput.value, {capitalize: true, inSentence: true})
    const partnerString = partnerInput.value === "United Kingdom"
        ? "the UK"
        : partnerInput.value === "USA"
            ? "the USA"
            : partnerInput.value;

    if (firstLink) {
        firstLink.textContent = flowString + partnerString
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
const countryInput = multiSelect(
    countries,
    {
        label: "Countries/regions",
        value: ["South Africa", "Kenya", "Nigeria", "Senegal", "Côte d'Ivoire"]
    })

const countryMulti = Generators.input(countryInput);

// Partner Input
const partnerInput = Inputs.select(
    partners,
    {
        label: "ONE market", 
        sort: true
    })
const partnerMulti = Generators.input(partnerInput)

// Select all input
const SelectAllInput = Inputs.toggle(
    {
        label: "Select all",
        value: true
    });

// Time Input
const timeRangeInput = rangeInput(
    {
        min: timeRange[0],
        max: timeRange[1],
        step: 1,
        value: [2012, 2022],
        label: "Time range",
        color: colorPalette.inputTheme,
        enableTextInput: true
    })
const timeRangeMulti = Generators.input(timeRangeInput)

// Aggregation input
const aggregationInput = Inputs.radio(
    ["All products", "Product categories"],
    {
        label: "Products",
        value: "All products"
    })
const aggregationMulti = Generators.input(aggregationInput)

// Categories Input
const categoriesInput = Inputs.checkbox(
    categories, 
    {
        label: "Categories",
        value: SelectAllInput.value ? categories : []
    });
const categoriesMulti = Generators.input(categoriesInput);

// Make categories checkboxes reactive to select all checkbox
SelectAllInput.addEventListener("input", () => {
    categoriesInput.value = SelectAllInput.value ? categories : [];
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
        label: "Currency",
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
        label: "Trade flow",
        value: "balance"
    }
)
const flowMulti = Generators.input(flowInput)
```

```html
<h1 class="header">
    Multi Country
</h1>

<p class="normal-text">
    Choose multiple African countries from the list below by dragging or Shift-clicking, and select or deselect a
    country by Command-clicking. Next, select a trading partner (ONE market) and a trade flow (trade balance, exports,
    imports). You can also adjust the time range, the product categories of traded goods and the unit of currency for
    the data shown.
</p>

<p class="normal-text">
    <a href="#trade-plot">This plot</a> contains a line for each african country showing the selected trade flow with the indicated trade partner.
</p>

<p class="normal-text">
    <a href="#trade-by-year">This table</a> shows the figures included in the plot, whereas 
    <a href="#trade-by-category">this one</a> presents trade data aggregated by product categories.
</p>

<br>

<div class="card" style="display: grid; gap: 0.5rem;">
    <div>${countryInput}</div>
    <div>${partnerInput}</div>
    <div>${timeRangeInput}</div>
    <div>${flowInput}</div>
    <div>${aggregationInput}</div>
    ${
        aggregationMulti === 'All products'
        ? ''
        : html`<div>${categoriesInput}</div><div>${SelectAllInput}</div>`
    }
    <div>${unitInput}</div>
</div>
    
<br>

<div class="viz-container" id="multi-plot">
    <div class="top-panel" style=`width:${width}`>
        <h2 class="plot-title" id="trade-plot">
            ${formatString(flowMulti, { capitalize: true, inSentence: true })}${partnerMulti}
        </h2>
        <h3 class="plot-subtitle">
            Selected African countries
        </h3>
    </div>
    <div>
        ${resize((width) =>
            plotMulti(
                tradeData, 
                countryMulti, 
                partnerMulti, 
                flowMulti, 
                timeRangeMulti, 
                aggregationMulti, 
                categoriesMulti, 
                unitMulti, 
                width
            )
        )}
    </div>
    <div class="bottom-panel" style=`width:${width}`>
        <div class="text-section">
            <p class="plot-source">
                Source: Gaulier and Zignago (2010)
                <a href="https://cepii.fr/CEPII/en/bdd_modele/bdd_modele_item.asp?id=37" target="_blank" rel="noopener noreferrer">
                    BACI: International Trade Database at the Product-Level
                </a>. CEPII
            </p>
        </div>
        <div class="logo-section">
            <img src=${oneLogo} alt="A black circle with ONE written in white thick letters."/>
        </div>
    </div>
</div>
<div class="download-panel">
    ${Inputs.button(
        "Download plot", {
            reduce: () => downloadPNG('multi-plot', 
            `${formatString(
                `${formatString(flowMulti, { capitalize: true, inSentence: true })}${partnerMulti}`, 
                { capitalize: false, fileMode: true })}`
            )}
    )}
    ${Inputs.button("Download data", {
        reduce: () => downloadXLSX(
            tradeData,
            countryMulti,
            partnerMulti,
            timeRangeMulti,
            aggregationMulti,
            categoriesMulti,
            unitMulti,
            flowMulti,
            "multi",
            `${formatString(
                `${formatString(flowMulti, { capitalize: true, inSentence: true })}${partnerMulti}`, 
                { capitalize: false, fileMode: true })}`
            )}
        )
    }
</div>

<br>
<br>

<div class="viz-container">
    <div class="top-panel" style=`width:${width}`>
        <h2 class="section-header" id="trade-by-category">
            Trade by category
        </h2>
        <p class="normal-text">
            All products value of
            <span class="bold-text">${formatString(flowMulti, { capitalize: false, inSentence: true })}</span>
            <span class="bold-text">${partnerMulti}</span> for each category of traded goods in
            <span class="bold-text">${timeRangeMulti[0]}-${timeRangeMulti[1]}</span>.
        </p>
    </div>
    <div>
        ${resize((width) =>
            tableMulti(
                tradeData, 
                countryMulti, 
                partnerMulti, 
                timeRangeMulti, 
                categoriesMulti, 
                unitMulti, 
                flowMulti, 
                "category", 
                width
            )
        )}
    </div>
    <div class="bottom-panel" style=`width:${width}`>
        <div class="text-section">
            <p class="plot-source">
                Source: Gaulier and Zignago (2010)
                <a href="https://cepii.fr/CEPII/en/bdd_modele/bdd_modele_item.asp?id=37" target="_blank" rel="noopener noreferrer">
                    BACI: International Trade Database at the Product-Level
                </a>. 
                CEPII
            </p>
            <p class="plot-note">All values 
                ${
                    unitMulti === "pct_gdp" ? "as percentage of GDP" : unitMulti === "constant_usd_2015" ? "in million constant 2015 USD" : "in million current USD"
                }.
            </p>
        </div>
        <div class="logo-section"> 
            <img src=${oneLogo} alt="A black circle with ONE written in white thick letters."/>
        </div>
    </div>
</div>

<br>
<br>

<div class="viz-container">
    <div class="top-panel" style=`width:${width}`>
        <h2 class="section-header" id="trade-by-year">
            Trade by year
        </h2>
        ${
            categoriesMulti.length === categories.length
            ? html`<p class="normal-text">All products yearly value of <span class="bold-text">${formatString(flowMulti, { capitalize: false, inSentence: true })}${partnerMulti}</span> including <span class="bold-text">all product categories</span>.</p>`
            : html`<p class="normal-text">All products yearly value of <span class="bold-text">${formatString(flowMulti, { capitalize: false, inSentence: true })}${partnerMulti}</span> including the following product categories:</p><ul>${categoriesMulti.map((item) => html`<li>${item}</li>`)}</ul><br>`
        }
    </div>
    <div>
        ${resize((width) =>
            tableMulti(
                tradeData, 
                countryMulti, 
                partnerMulti, 
                timeRangeMulti, 
                categoriesMulti, 
                unitMulti, 
                flowMulti, 
                "year", 
                width
            )
        )}
    </div>
    <div class="bottom-panel" style=`width:${width}`>
        <div class="text-section">
            <p class="plot-source">
                Source: Gaulier and Zignago (2010)
                <a href="https://cepii.fr/CEPII/en/bdd_modele/bdd_modele_item.asp?id=37" target="_blank" rel="noopener noreferrer">
                    BACI: International Trade Database at the Product-Level
                </a>
                . CEPII
            </p>
            <p class="plot-note">All values 
                ${
                    unitMulti === "pct_gdp" ? "as percentage of GDP" : unitMulti === "constant_usd_2015" ? "in million constant 2015 USD" : "in million current USD"
                }.
            </p>
        </div>
        <div class="logo-section">
            <img src=${oneLogo} alt="A black circle with ONE written in white thick letters."/>
        </div>
    </div>
</div>
```