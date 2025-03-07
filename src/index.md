```js

import {singleQueries} from "./components/queries.js"

import {setCustomColors} from "./components/colors.js"
import {getUnitLabel, formatString, generateTitleSingle, generateSubtitle, generateNote} from "./components/utils.js"
import {maxTimeRange, productCategories, groupMappings} from "./components/inputValues.js";

import {rangeInput} from "./components/rangeInput.js";

import {topPartnersTable} from "./components/visuals.js";

// import {downloadPNG, downloadXLSX} from './components/downloads.js';
```

```js 
setCustomColors();
```

```js
// USER INPUTS

const countries = Object.keys(groupMappings)
const groups = Object.values(groupMappings)

// Country Input
const countryInput = Inputs.select(
    countries,
    {
        label: "Country",
        sort: true,
        value: "Algeria"
    })

const country = Generators.input(countryInput);

// Unit Input
const unitInput = Inputs.select(
    new Map([
        ["US Dollars", "usd"],
        ["Canada Dollars", "cad"],
        ["Euros", "eur"],
        ["British pounds", "gbp"],
        ["Share of GDP", "gdp"]
    ]),
    {
        label: "Unit"
    }
);
const unit = Generators.input(unitInput)

// Flow input
const flowInput = Inputs.radio(
    new Map([
        ["Exports", "exports"],
        ["Imports", "imports"]
    ]),
    {
        label: "Trade flow",
        value: "exports"
    }
)
const flow = Generators.input(flowInput)

// Category Input
const categoryInput = Inputs.select(
    ["All", ...productCategories], {
        label: "Category",
        value: "All"
    }
);
const category = Generators.input(categoryInput)

// Prices Input
const pricesInput = Inputs.radio(
    new Map([
        ["Constant", "constant"],
        ["Current", "current"]
    ]),
    {
        label: "Prices",
        value: "constant"
    }
);
const prices = Generators.input(pricesInput)

// Time Input
const timeRangeInput = rangeInput(
    {
        min: maxTimeRange[0],
        max: maxTimeRange[1],
        step: 1,
        value: [maxTimeRange[1] - 10, maxTimeRange[1]],
        label: "Time range",
        enableTextInput: true
    })
const timeRange = Generators.input(timeRangeInput)
```

```js
// DATA  QUERIES

const queries = singleQueries(country, unit, prices, timeRange, category, flow)

const dataTopPartners = queries[0]
const dataTopCategories = queries[1]
```

<div class="title-container">
    <div class="title-logo">
        <a href="https://data.one.org/" target="_blank">
            <img src="./ONE-logo-black.png" alt="A black circle with ONE written in white thick letters.">
        </a>
    </div>
    <h1 class="title-text">
        Trade explorer
    </h1>
</div>

<div class="header card">
    <a class="view-button active" href="./">
         Country
    </a>
    <a class="view-button" href="./multi">
        Multi Country
    </a>
    <a class="view-button" href="./about">
        About
    </a>
</div>

<div class="card settings">
    <div class="settings-group">
        ${countryInput}
        ${flowInput}
    </div>
    <div class="settings-group">
        ${unitInput}
        ${categoryInput}
    </div>
    <div class="settings-group">
        ${unit === 'gdp' ? html` ` : pricesInput}
        ${timeRangeInput}
    </div>
</div>
<div class="grid grid-cols-2">
    <div class="card">
        ${generateTitleSingle(country, flow, {})}
        <h3 class="plot-subtitle">
            ${
                category === "All" 
                ? "All products"
                : category
            };
            ${
                timeRange[0] === timeRange[1] 
                ? timeRange[0] 
                : `${timeRange[0]}-${timeRange[1]}`
            }
        </h3>
        ${
            resize(
                (width) => topPartnersTable(dataTopPartners, flow, width)
            )
        }
        <div class="bottom-panel">
            <div class="text-section">
                ${generateNote(unit, prices, country)}
            </div>
            <div class="logo-section">
                <a href="https://data.one.org/" target="_blank">
                    <img src="./ONE-logo-black.png" alt="A black circle with ONE written in white thick letters.">
                </a>
            </div>
        </div>
    </div>
    <div class="card">
        ${generateTitleSingle(country, flow, {plot: false})}
        <h3 class="plot-subtitle">
            Product categories;
            ${
                timeRange[0] === timeRange[1] 
                ? timeRange[0] 
                : `${timeRange[0]}-${timeRange[1]}`
            }
        </h3>
        ${
            resize(
                (width) => topPartnersTable(dataTopCategories, flow, width)
            )
        }
        <div class="bottom-panel">
            <div class="text-section">
                ${generateNote(unit, prices, country)}
            </div>
            <div class="logo-section">
                <a href="https://data.one.org/" target="_blank">
                    <img src="./ONE-logo-black.png" alt="A black circle with ONE written in white thick letters.">
                </a>
            </div>
        </div>
    </div>
</div>