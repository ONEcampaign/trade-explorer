```js
import {setCustomColors} from "./components/colors.js"
import {
    getUnitLabel, 
    formatString,
    generateTitle,
    generateSubtitle, 
    generateFooter, 
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
        value: [maxTimeRange[1] - 21, maxTimeRange[1]],
        label: "Time range",
        enableTextInput: true
    })
const timeRange = Generators.input(timeRangeInput)

```

```js

// DATA  QUERIES

import {multiQueries} from "./components/dataQueries.js"

const data = multiQueries(
    country,
    partners,
    unit,
    prices,
    timeRange,
    category,
    flow
)

const plotData = data.plot
const tableData = data.table

const isMultiPartner = partners.length > 1



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
    <a class="view-button" href="./faqs">
        FAQs
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
        ${isMultiPartner ? flowInput : html` `}
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
                    ${generateTitle({country: country, partners: partners, flow: flow, mode: "plot"})}
                    ${generateSubtitle({partners: partners, flow: flow, category: category, mode: "plot"})}
                    ${resize((width) => tradePlot(plotData, partners, unit, flow, width, {}))}
                    ${await generateFooter({unit: unit, prices: prices, country: country, flow: flow, isMultiPartner: isMultiPartner})}
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
                    ${
                        Inputs.button(
                            "Download data", {
                                reduce: () => downloadXLSX(
                                    plotData,
                                    generateFileName(country, timeRange, partners, flow, {})
                                )
                            }
                        )
                    }
                </div>
            </div>
            <div class="card">
                <div class="plot-container" id="multi-table">
                    ${generateTitle({country: country, partners: partners, flow: flow, mode: "plot"})}
                    ${generateSubtitle({category: category, timeRange: timeRange, mode: "table-multi"})}
                    ${resize((width) => tradeTable(tableData, flow, width))}
                    ${await generateFooter({unit: unit, prices: prices, country: country, flow: flow, isMultiPartner: isMultiPartner})}
                </div>
                <div class="download-panel">
                        ${
                            Inputs.button(
                                "Download data", {
                                    reduce: () => downloadXLSX(
                                        tableData,
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