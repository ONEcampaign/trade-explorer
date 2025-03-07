```js
import {setCustomColors} from "./components/colors.js"
import {
    getUnitLabel, 
    formatString,
    generateTitleMulti,
    generateSubtitle, 
    generateNote, 
    generateFileName
} from "./components/utils.js"
import {maxTimeRange, productCategories, groupMappings} from "./components/inputValues.js";
import {rangeInput} from "./components/rangeInput.js";
import {multiSelect} from "./components/multiSelect.js";
import {tradePlot,  tradeTable} from "./components/visuals.js";
import {downloadPNG, downloadXLSX} from './components/downloads.js';
```

```js 
setCustomColors();
```

```js
const ONELogo = await FileAttachment("./ONE-logo-black.png").image()
```

```js

// USER INPUTS

const countries = Object.keys(groupMappings)
const groups = Object.values(groupMappings)

// Country
const countryInput = Inputs.select(
    countries,
    {
        label: "Country",
        sort: true,
        value: "Kenya"
    })

// Partner
const partnersInput = multiSelect(
    countries,
    {
        label: "Partner(s)",
        value: ["Canada"]
    })

// Disable options condionally
function updateOptions() {

    const countryList = groupMappings[countryInput.value]
    const partnerList = partnersInput.value.flatMap(group => groupMappings[group] || [group]);
    if (countryList.some(country => partnerList.includes(country))) {
        partnersInput.value = countries
            .filter(group => {
                let elements = groupMappings[group] || [group];
                return !elements.some(country => countryList.includes(country));
            })
            // Pick 5 random items that don't overlap
            .sort(() => Math.random() - 0.5)
            .slice(0, 5);
    }

    for (const o of partnersInput.querySelectorAll("option")) {
        const groupList = groupMappings[o.value]
        if (groupList.some(item => countryList.includes(item))) {
            o.setAttribute("disabled", "disabled");
        } else o.removeAttribute("disabled");
    }

    for (const o of countryInput.querySelectorAll("option")) {
        const groupList = groups[o.value]
        if (groupList.some(item => partnerList.includes(item))) {
            o.setAttribute("disabled", "disabled");
        } else o.removeAttribute("disabled");
    }

}

updateOptions();
countryInput.addEventListener("input", updateOptions);
partnersInput.addEventListener("input", updateOptions);

const country = Generators.input(countryInput);
const partners = Generators.input(partnersInput);

// Unit
const unitInput = Inputs.select(
    new Map([
        ["US Dollars", "usd"],
        ["Canada Dollars", "cad"],
        ["Euros", "eur"],
        ["British pounds", "gbp"],
        ["Share of GDP", "gdp"]
    ]),
    {
        label: "Unit",
        value: "US Dollars"
    }
);
const unit = Generators.input(unitInput)

// Flow
const flowInput = Inputs.select(
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
const flow = Generators.input(flowInput)

// Product category
const categoryInput = Inputs.select(
    ["All", ...productCategories], {
        label: "Category",
        value: "All"
    }
);
const category = Generators.input(categoryInput)

// Prices
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

// Time range
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

import {queryMulti} from "./components/dataQueries.js"

const data = queryMulti(
    country, 
    partners, 
    unit, 
    prices, 
    timeRange, 
    category, 
    flow
)

const isPartners = partners.length > 1 ? true : false
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
    <a class="view-button" href="./">
        Single Country
    </a>
    <a class="view-button active" href="./multi">
        Multi Country
    </a>
    <a class="view-button" href="./about">
        About
    </a>
</div>

<div class="card settings">
    <div class="settings-group">
        ${countryInput}
        ${partnersInput}
    </div>
    <div class="settings-group">
        ${unitInput}
        ${categoryInput}
    </div>
    <div class="settings-group">
        ${unit === "gdp" ? html` ` : pricesInput}
        ${timeRangeInput}
        ${isPartners ? flowInput : html` `}
    </div>
</div>
${ 
    partners.length === 0 
    ? html`
        <div class="grid grid-cols-2">
            <div class="card"> 
                <div class="warning">
                    Select at least one partner
                </div>
            </div>
        </div>
    `
    : html`
        <div class="grid grid-cols-2">
            <div class="card">
                <div class="plot-container" id="multi-plot">
                    ${generateTitleMulti(country, partners, flow)}
                    ${generateSubtitle(partners, flow, timeRange, {table: false})}
                    ${
                        resize(
                            (width) => tradePlot(data, flow, width)
                        )
                    }
                    <div class="bottom-panel">
                        <div class="text-section">
                            ${generateNote(unit, prices, country, partners, flow)}
                        </div>
                        <div class="logo-section">
                            <a href="https://data.one.org/" target="_blank">
                                ${ONELogo}
                            </a>
                        </div>
                    </div>
                </div>
                <div class="download-panel">
                    ${
                        Inputs.button(
                            "Download plot", {
                                reduce: () => downloadPNG(
                                    'multi-plot',
                                    generateFileName(country, timeRange, partners, flow, {png: true})
                                )
                            }
                        )
                    }
                </div>
            </div>
            <div class="card">
                <div class="plot-container" id="multi-table">
                        ${generateTitleMulti(country, partners, flow)}
                        ${generateSubtitle(partners, flow, timeRange, {table: true})}
                        ${resize((width) =>
                            tradeTable(data, flow, width)
                        )}
                        <div class="bottom-panel">
                            <div class="text-section">
                                ${generateNote(unit, prices, country, partners, flow)}
                            </div>
                            <div class="logo-section">
                                <a href="https://data.one.org/" target="_blank">
                                    ${ONELogo}
                                </a>
                            </div>
                        </div>
                </div>
                <div class="download-panel">
                        ${
                            Inputs.button(
                                "Download data", {
                                    reduce: () => downloadXLSX(
                                        data,
                                        generateFileName(country, timeRange, partners, flow, {})
                                    )
                                }
                            )
                        }
                </div>
            </div>
        </div>
    `
}