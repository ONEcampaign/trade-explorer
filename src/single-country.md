```js 
import {FileAttachment} from "observablehq:stdlib";
import {min, max} from "npm:d3-array";
import {timeParse, timeFormat} from "npm:d3-time-format"
import {sortCountries} from "./components/sortCountries.js";
import {rangeInput} from "./components/rangeInput.js";
import {dropdownInput} from "./components/dropdownInput.js";
import {plotSingle} from "./components/plotSingle.js";
import {tableSingle} from "./components/tableSingle.js";
import {colorPalette} from "./components/colorPalette.js";
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
    .map(d => {
        return {
            ...d,
            year: Number(d.year),  // Convert year to integer
            date: new Date(Number(d.year) + 0, 1, 1)  // Create a date for the middle of the previous year (July 1st)
        };
    });
```

```js
// Input options
const countries = sortCountries(Array.from(new Set(tradeData.map((d) => d.country))));
const partners = Array.from(new Set(tradeData.map((d) => d.partner)));
const categories = Array.from(new Set(tradeData.map((d) => d.category)))
        .filter((item) => item !== "All products");
const timeRange = [min(tradeData, (d) => d.year), max(tradeData, (d) => d.year)]
```

```js
const oneLogo = FileAttachment("./ONE-logo-black.png").href;
```

```js
// Remane plot link in toc
const firstLink = document.querySelector("li.observablehq-secondary-link a");

function updateFirstLinkText() {
    const countryString = countryInput.value === "Dem. Rep. of the Congo"
        ? "DRC-"
        : countryInput.value + "-"
    const partnerString = partnerInput.value === "United Kingdom"
        ? "UK"
        : partnerInput.value;

    if (firstLink) {
        firstLink.textContent = countryString + partnerString + " trade"
    }
}

// Add event listeners to update text reactively
countryInput.addEventListener("input", updateFirstLinkText);
partnerInput.addEventListener("input", updateFirstLinkText);

// Initial call to set the text content on page load
updateFirstLinkText();
```

```js
// Country Input
const countryInput = Inputs.select(
    countries,
    {
        label: "Country/region",
        value: "Algeria"
    })
const countrySingle = Generators.input(countryInput);

// Partner Input
const partnerInput = Inputs.select(
    partners,
    {
        label: "ONE market", 
        sort: true
    })
const partnerSingle = Generators.input(partnerInput)

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
const timeRangeSingle = Generators.input(timeRangeInput)


// Aggregation input
const aggregationInput = Inputs.radio(
    ["All products", "Product categories"],
    {
        label: "Products",
        value: "All products"
    })
const aggregationSingle = Generators.input(aggregationInput)

// Categories Input
const categoriesInput = dropdownInput({
    inputLabel: "Categories",
    placeholderText: "Select a category...",
    options: categories,
    selected: ["Mineral products"]
})
const categoriesSingle = Generators.input(categoriesInput);

// Unit input
const unitInput = Inputs.radio(
    new Map([
        ["Constant USD", "constant_usd_2015"],
        ["Current USD", "current_usd"],
        ["Percentage of GDP", "pct_gdp"]
    ]),
    {
        label: "Currency",
        value: "constant_usd_2015"
    }
)
const unitSingle = Generators.input(unitInput)
```

```js
const tabSelection = Mutable("Settings")
const selectSettings = () => tabSelection.value = "Settings";
const selectAdvanced = () => tabSelection.value = "Advanced";
```

```html
<h1 class="header">
    Single Country
</h1>

<p class="normal-text">
    Explore trade between an African country or region and a ONE market.
</p>

<p class="normal-text">
    <a href="#trade-plot">This plot</a> shows exports and imports between the two countries as well as a line representing their trade balance (difference between exports and imports).
</p>

<p class="normal-text">
    The tables below present trade figures aggregated
    <a href="#trade-by-year">by year</a> and
    <a href="#trade-by-category">product</a>.
</p>

<br>

<div class="tab-wrap">
    <div class="tab">
        <div class="tab-button ${tabSelection === 'Settings' ? 'active' : ''}">    
            ${Inputs.button("Settings", {reduce: selectSettings})}
        </div>
        <div class="tab-button ${tabSelection === 'Advanced' ? 'active' : ''}">
            ${Inputs.button("Advanced", {reduce: selectAdvanced})}
        </div>
    </div>

    <div class="tab-content ${tabSelection === 'Settings' ? 'show' : ''}">
        <div>${countryInput}</div>
        <div>${partnerInput}</div>
        <div>${unitInput}</div>
    </div>

    <div class="tab-content ${tabSelection === 'Advanced' ? 'show' : ''}">
        <div>${timeRangeInput}</div>
        <div>${aggregationInput}</div>    
        ${
            aggregationSingle === 'All products'
            ? ''
            : html`<div>${categoriesInput}</div>`
        }
    </div>
</div>

<br>
    
<div id="single-plot" class="viz-container">
    <div class="top-panel" style=`width:${width}`>
        <h2 class="plot-title" id="trade-plot">
            ${`Trade between ${countrySingle === "Dem. Rep. of the Congo" ? "DRC" : countrySingle} and ${partnerSingle}`}
        </h2>
        <h3 class="plot-subtitle">
            <span class="export-subtitle-label">Exports</span>, 
            <span class="import-subtitle-label">imports</span> and 
            <span class="balance-subtitle-label">trade balance</span> 
            ${unitSingle === "pct_gdp" ? "as percentage of GDP" : "in million USD"}
        </h3>
    </div>
    <div>
        ${resize((width) =>
            plotSingle(
                tradeData, 
                countrySingle, 
                partnerSingle, 
                timeRangeSingle, 
                aggregationSingle, 
                categoriesSingle, 
                unitSingle, 
                width
            )
        )}
    </div>
    <div class="bottom-panel" style=`width:${width}`>
        <div class="text-section">
            <p class="plot-source">Source: Gaulier and Zignago (2010) <a href="https://cepii.fr/CEPII/en/bdd_modele/bdd_modele_item.asp?id=37" target="_blank" rel="noopener noreferrer">BACI: International Trade Database at the Product-Level</a>. CEPII</p>
        </div>
        <div class="logo-section">
            <img src=${oneLogo} alt="A black circle with ONE written in white thick letters.">
        </div>
    </div>
</div>
<div class="download-panel">
    ${Inputs.button("Download plot", {
        reduce: () => downloadPNG(
            'single-plot',
            formatString(
                `Trade between ${countrySingle === "Dem. Rep. of the Congo" ? "DRC" : countrySingle} and ${partnerSingle}`,
                { capitalize: false, fileMode: true }
            )
        )
    })}
    ${Inputs.button("Download data", {
        reduce: () => downloadXLSX(
            tradeData,
            countrySingle,
            partnerSingle,
            timeRangeSingle,
            aggregationSingle,
            categoriesSingle,
            unitSingle,
            null,
            "single",
            formatString(
                `Trade between ${countrySingle === "Dem. Rep. of the Congo" ? "DRC" : countrySingle} and ${partnerSingle}`,
                { capitalize: false, fileMode: true }
            )
        )
    })}
</div>
    
<br>
<br>

<div class="viz-container">
    <div class="top-panel" style=`width:${width}`>
        <h2 class="section-header" id="trade-by-category">
            Trade by category
        </h2>
        <p class="normal-text">
            Total value of exports, imports and trade balance for each category of traded goods between 
            <span class="bold-text">${countrySingle === "Dem. Rep. of the Congo" ? "DRC" : countrySingle}</span> and 
            <span class="bold-text">${partnerSingle}</span> in 
            <span class="bold-text">${timeRangeSingle[0]}-${timeRangeSingle[1]}</span>.
        </p>
    </div>
    <div>
        ${resize((width) =>
            tableSingle(
                tradeData,
                countrySingle,
                partnerSingle,
                timeRangeSingle,
                aggregationSingle,
                categoriesSingle,
                unitSingle,
                "category",
                width
            )
        )}
    </div>
    <div class="bottom-panel" style=`width:${width}`>
        <div class="text-section"> 
            <p class="plot-source">Source: Gaulier and Zignago (2010) <a href="https://cepii.fr/CEPII/en/bdd_modele/bdd_modele_item.asp?id=37" target="_blank" rel="noopener noreferrer">BACI: International Trade Database at the Product-Level</a>. CEPII</p>
            <p class="plot-note">All values ${unitSingle === "pct_gdp" ? "as percentage of GDP" : unitSingle === "constant_usd_2015" ? "in million constant 2015 USD" : "in million current USD"}.</p>
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
            aggregationSingle === "All products"
            ? html`<p class="normal-text">Total yearly value of imports, exports and trade balance between <span class="bold-text">${countrySingle === "Dem. Rep. of the Congo" ? "DRC" : countrySingle}</span> and <span class="bold-text">${partnerSingle}</span> including <span class="bold-text">all product categories</span>.</p>`
            : html`<p class="normal-text">Total yearly value of imports, exports and trade balance between <span class="bold-text">${countrySingle === "Dem. Rep. of the Congo" ? "DRC" : countrySingle}</span> and <span class="bold-text">${partnerSingle}</span> including the following product categories:</p> <ul>${categoriesSingle.map((item) => html`<li>${item}</li>`)}</ul><br>`
        }
    </div>
    <div>
        ${resize((width) =>
            tableSingle(
                tradeData,
                countrySingle,
                partnerSingle,
                timeRangeSingle,
                aggregationSingle,
                categoriesSingle,
                unitSingle,
                "year",
                width
            )
        )}
    </div>
    <div class="bottom-panel" style=`width:${width}`>
        <div class="text-section">
            <p class="plot-source">
                Source: Gaulier and Zignago (2010) 
                    <a href="https://cepii.fr/CEPII/en/bdd_modele/bdd_modele_item.asp?id=37" target="_blank" rel="noopener noreferrer">BACI: International Trade Database at the Product-Level</a>. 
                CEPII
            </p>
            <p class="plot-note">All values 
                ${
                    unitSingle === "pct_gdp" ? "as percentage of GDP" : unitSingle === "constant_usd_2015" ? "in million constant 2015 USD" : "in million current USD"
                }.
            </p>
        </div>
        <div class="logo-section">
            <img src=${oneLogo} alt="A black circle with ONE written in white thick letters."/>
        </div>
    </div>
</div>
```