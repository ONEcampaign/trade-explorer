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
import {tradePlot, rankTable} from "./components/visuals.js";
import {downloadPNG, downloadXLSX} from './components/downloads.js';
```

```js 
setCustomColors();
```

```js

// USER INPUTS

const countries = Object.keys(groupMappings)
const groups = Object.values(groupMappings)
const multiGroups = [
    "All countries*",
    ...Object.entries(groupMappings)
        .filter(([, countries]) => countries.length > 1)
        .map(([key]) => key)
];

// Country Input
const countryInput = Inputs.select(
    countries,
    {
        label: "Country",
        sort: true,
        value: "South Africa"
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
        value: [maxTimeRange[0], maxTimeRange[1]],
        label: "Time range",
        enableTextInput: true
    })
const timeRange = Generators.input(timeRangeInput)

// Country group input
const groupInput = Inputs.select(
    multiGroups,
    {
        label: "Country group",
        sort: true,
        value: "All countries*"
    })

const group = Generators.input(groupInput);

```

```js

// DATA  QUERIES

import {singleQueries} from "./components/dataQueries.js"

const data = singleQueries(
    country, 
    unit, 
    prices, 
    timeRange, 
    category,
    flow,
    group
)

const worldTradeData = data.worldTrade
const partnersData = data.partners
const categoriesData = data.categories

```

<div class="header card">
    <a class="view-button active" href="./">
         Single Country
    </a>
    <a class="view-button" href="./multi">
        Multi Country
    </a>
    <a class="view-button" href="./faqs">
        FAQs
    </a>
</div>

<div class="card settings">
    <div class="settings-group">
        ${countryInput}
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
    ${
        !data
        ? html` `
        : html`
            <div class="card">
                <div class="plot-container wide" id="single-plot">
                    ${generateTitle({country: country, partners: ["the world"], mode: "plot"})}
                    ${generateSubtitle({partners: [""], category: category, mode: "plot"})}
                    ${resize((width) => tradePlot(worldTradeData, [""], unit, flow, width, {wide: true}))}
                    ${await generateFooter({unit: unit, prices: prices, country: country, isGlobalTrade: true})}
                </div>
                <div class="download-panel">
                    ${
                        Inputs.button(
                            "Download plot", {
                                reduce: () => downloadPNG(
                                    'single-plot',
                                    generateFileName({country:country, partners:["the world"], category:category, timeRange:timeRange, mode:"plot"})
                                )
                            }
                        )
                    }
                    ${
                        Inputs.button(
                            "Download data", {
                                reduce: () => downloadXLSX(
                                    worldTradeData,
                                    generateFileName({country:country, partners:["the world"], category:category, timeRange:timeRange, mode:"plot"})
                                )
                            }
                        )
                    }
                </div>
            </div>
            <div class="card settings">
                <div class="settings-group">
                    ${flowInput}
                </div>
                <div class="settings-group">
                    ${groupInput}
                </div>
            </div>
            <div class="grid grid-cols-2">
                <div class="card">
                    <div class="plot-container">
                        ${generateTitle({country: country, flow: flow, group: group, mode: "table-top-partners"})}
                        ${generateSubtitle({category: category, timeRange: timeRange, mode: "table-top-partners"})}
                        ${resize((width) => rankTable(partnersData, flow, 'partner', width))}
                        ${await generateFooter({unit: unit, prices: prices, country: country, flow: flow, group: group, isGlobalTrade: true})}
                    </div>
                    <div class="download-panel">
                        ${
                            Inputs.button(
                                "Download data", {
                                    reduce: () => downloadXLSX(
                                        partnersData,
                                        generateFileName({country: country, category:category, timeRange: timeRange, flow: flow, mode: "table-partners"})
                                    )
                                }
                            )
                        }
                    </div>
                </div>
                <div class="card">
                    <div class="plot-container">
                        ${generateTitle({country: country, flow: flow, group: group, mode: "table-top-categories"})}
                        ${generateSubtitle({category: category, timeRange: timeRange, mode: "table-top-categories"})}
                        ${resize((width) => rankTable(categoriesData, flow, 'category', width))}
                        ${await generateFooter({unit: unit, prices: prices, country: country, flow: flow, group: group, isGlobalTrade: true})}
                    </div>
                    <div class="download-panel">
                        ${
                            Inputs.button(
                                "Download data", {
                                    reduce: () => downloadXLSX(
                                        categoriesData,
                                        generateFileName({country: country, timeRange: timeRange, flow: flow, mode: "table-categories"})
                                    )
                                }
                            )
                        }
                    </div>
                </div>
            </div>
        `
    }
