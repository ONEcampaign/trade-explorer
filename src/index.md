```js
import {DuckDBClient} from "npm:@observablehq/duckdb";

import {setCustomColors} from "./components/setCustomColors.js";

import {timeRange, categories, groupMappings} from "./components/inputValues.js";

import {rangeInput} from "./components/rangeInput.js";

import {formatString} from "./components/formatString.js";

import {plotSingle} from "./components/plotSingle.js";
import {tableSingle} from "./components/tableSingle.js";
import {plotMulti} from "./components/plotMulti.js";
import {tableMulti} from "./components/tableMulti.js";

import {downloadPNG} from './components/downloadPNG.js';
import {downloadXLSX} from "./components/downloadXLSX.js";
```

```js 
setCustomColors();
```

```js
const oneLogo = FileAttachment("./ONE-logo-black.png").href;
```

```js
const db = DuckDBClient.of({
    trade: FileAttachment("./data/trade.parquet"),
    conversion_table: FileAttachment("./data/conversions.parquet")

});
```

```js
// USER INPUTS

const countries = Object.keys(groupMappings)
const groups = Object.values(groupMappings)

// SINGLE COUNTRY VIEW
// Country Input
const countrySingleInput = Inputs.select(
    countries,
    {
        label: "Entity",
        sort: true,
    })

// Partner Input
const partnerSingleInput = Inputs.select(
    countries,
    {
        label: "Partner",
        sort: true
    }
);

function updateOptionsSingle() {
    for (const o of partnerSingleInput.querySelectorAll("option")) {
        const g = groups[o.value]
        const v = groupMappings[countrySingleInput.value]
        if (g.some(item => v.includes(item))) {
            o.setAttribute("disabled", "disabled");
            if (partnerSingleInput.value === countrySingleInput.value) {
                partnerSingleInput.value = countries.find(d => d !== countrySingleInput.value);
            }
        }
        else o.removeAttribute("disabled");
    }

    for (const o of countrySingleInput.querySelectorAll("option")) {
        if (countries[o.value] === partnerSingleInput.value) {
            o.setAttribute("disabled", "disabled");
            if (countrySingleInput.value === partnerSingleInput.value) {
                countrySingleInput.value = countries.find(d => d !== partnerSingleInput.value);
            }
        }
        else o.removeAttribute("disabled");
    }
}

updateOptionsSingle();
countrySingleInput.addEventListener("input", updateOptionsSingle);

const countrySingle = Generators.input(countrySingleInput);
const partnerSingle = Generators.input(partnerSingleInput);

// Time Input
const timeRangeSingleInput = rangeInput(
    {
        min: timeRange[0],
        max: timeRange[1],
        step: 1,
        value: [timeRange[1] - 10, timeRange[1]],
        label: "Time range",
        enableTextInput: true
    })
const timeRangeSingle = Generators.input(timeRangeSingleInput)

// Currency Input
const currencySingleInput = Inputs.select(
    new Map([
        ["US Dollars", "usd"],
        ["Canada Dollars", "cad"],
        ["Euros", "eur"],
        ["British pounds", "gbp"]
    ]),
    {
        label: "Currency"
    }
);
const currencySingle = Generators.input(currencySingleInput)

// Prices Input
const pricesSingleInput = Inputs.radio(
    new Map([
        ["Constant", "constant"],
        ["Current", "current"]
    ]),
    {
        label: "Prices",
        value: "constant"
    }
);
const pricesSingle = Generators.input(pricesSingleInput)


// MULTI COUNTRY VIEW
// Country Input
const countryMultiInput = Inputs.select(
    countries,
    {
        label: "Entity",
        sort: true,
        value: "Canada"
    })

// Partner Input
const partnersMultiInput = Inputs.select(
    countries,
    {
        label: "Partner",
        multiple: 5,
        sort: true,
        value: ["South Africa", "Kenya", "Nigeria", "Senegal", "Côte d'Ivoire"]
    })

function updateOptionsMulti() {
    for (const o of partnersMultiInput.querySelectorAll("option")) {        
        const g = groups[o.value]
        const v = groupMappings[countryMultiInput.value]
        if (g.some(item => v.includes(item))) {
            o.setAttribute("disabled", "disabled");
            if (partnersMultiInput.value === countryMultiInput.value) {
                partnersMultiInput.value = countries.find(d => d !== countryMultiInput.value);
            }
        }
        else o.removeAttribute("disabled");
    }

    for (const o of countryMultiInput.querySelectorAll("option")) {
        if (countries[o.value] === partnersMultiInput.value) {
            o.setAttribute("disabled", "disabled");
            if (countryMultiInput.value === partnersMultiInput.value) {
                countryMultiInput.value = countries.find(d => d !== partnersMultiInput.value);
            }
        }
        else o.removeAttribute("disabled");
    }
}

updateOptionsMulti();
countryMultiInput.addEventListener("input", updateOptionsMulti);

const countryMulti = Generators.input(countryMultiInput);
const partnersMulti = Generators.input(partnersMultiInput);

// Time Input
const timeRangeMultiInput = rangeInput(
    {
        min: timeRange[0],
        max: timeRange[1],
        step: 1,
        value: [timeRange[1] - 10, timeRange[1]],
        label: "Time range",
        enableTextInput: true
    })
const timeRangeMulti = Generators.input(timeRangeMultiInput)

// Flow input
const flowMultiInput = Inputs.radio(
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
const flowMulti = Generators.input(flowMultiInput)

// Currency Input
const currencyMultiInput = Inputs.select(
    new Map([
        ["US Dollars", "usd"],
        ["Canada Dollars", "cad"],
        ["Euros", "eur"],
        ["British pounds", "gbp"]
    ]),
    {
        label: "Currency"
    }
);
const currencyMulti = Generators.input(currencyMultiInput)

// Prices Input
const pricesMultiInput = Inputs.radio(
    new Map([
        ["Constant", "constant"],
        ["Current", "current"]
    ]),
    {
        label: "Prices",
        value: "constant"
    }
);
const pricesMulti = Generators.input(pricesMultiInput)
```

```js
// DATA  QUERIES

function getCountryList(name) {
    if (Array.isArray(name)) {
        return name.flatMap(n => groupMappings[n] || [n]);
    }
    return groupMappings[name] || [name];
}

const escapeSQL = (str) => str.replace(/'/g, "''");

const unpivotColumns = categories.map(cat => `'${escapeSQL(cat)}'`).join(", ");

// SINGLE COUNTRY VIEW

const countrySingleList = getCountryList(countrySingle);
const partnerSingleList = getCountryList(partnerSingle);

const countrySingleSQLList = countrySingleList
    .map(c => `'${escapeSQL(c)}'`)
    .join(", ");
const partnerSingleSQLList = partnerSingleList
    .map(c => `'${escapeSQL(c)}'`)
    .join(", ");


const currencyColumnSingle = `${currencySingle}_${pricesSingle}`;

const querySingleString = `
    WITH filtered AS (
        SELECT * 
        FROM trade
        WHERE 
            ((exporter IN (${countrySingleSQLList}) AND importer IN (${partnerSingleSQLList})) OR 
            (importer IN (${countrySingleSQLList}) AND exporter IN (${partnerSingleSQLList}))) 
            AND year BETWEEN ? AND ?
    ),
    unpivoted AS (
        SELECT year, exporter, importer, category, value
        FROM filtered
        UNPIVOT (value FOR category IN (${unpivotColumns}))
    ),
    exports AS (
        SELECT year, category, SUM(value) AS exports
        FROM unpivoted
        WHERE exporter IN (${countrySingleSQLList}) 
        AND importer IN (${partnerSingleSQLList})
        GROUP BY year, category
    ),
    imports AS (
        SELECT year, category, SUM(value) AS imports
        FROM unpivoted
        WHERE importer IN (${countrySingleSQLList}) 
        AND exporter IN (${partnerSingleSQLList})
        GROUP BY year, category
    ),
    trade_data AS (
        SELECT 
            COALESCE(e.year, i.year) AS year,
            COALESCE(e.category, i.category) AS category,
            COALESCE(e.exports, 0) AS exports,
            COALESCE(i.imports, 0) * -1 AS imports,
            COALESCE(e.exports, 0) - COALESCE(i.imports, 0) AS balance
        FROM exports e
        FULL OUTER JOIN imports i
        ON e.year = i.year AND e.category = i.category
    )
    SELECT 
        t.year,
        t.category,
        (t.exports * c.${currencyColumnSingle}) AS exports,
        (t.imports * c.${currencyColumnSingle}) AS imports,
        (t.balance * c.${currencyColumnSingle}) AS balance
    FROM trade_data t
    LEFT JOIN conversion_table c
    ON t.year = c.year
`;

const querySingleParams = [timeRangeSingle[0], timeRangeSingle[1]];

const querySingle = await db.query(querySingleString, querySingleParams);


//  MULTI COUNTRY VIEW

const countryMultiList = getCountryList(countryMulti);
const partnersMultiList = getCountryList(partnersMulti);

const countryMultiSQLList = countryMultiList.map(escapeSQL).map(c => `'${c}'`).join(", ");
const partnersMultiSQLList = partnersMultiList.map(escapeSQL).map(c => `'${c}'`).join(", ");

// Define currency column
const currencyColumnMulti = `${currencyMulti}_${pricesMulti}`;

// Define flow column selection
const flowColumn = flowMulti === 'exports' ? `COALESCE(SUM(e.exports), 0)` :
    flowMulti === 'imports' ? `COALESCE(SUM(i.imports), 0) * -1` :
        flowMulti === 'balance' ? `COALESCE(SUM(e.exports), 0) - COALESCE(SUM(i.imports), 0)` :
            null;

// Generate CASE statement for importer/exporter mappings
function caseStatement(name) {
    return partnersMulti.map(group =>
        `CASE WHEN ${name} IN (${groupMappings[group].map(escapeSQL).map(c => `'${c}'`).join(", ")}) THEN '${escapeSQL(group)}' END`
    ).join(", ");
}

const queryMultiString = `
    WITH filtered AS (
        SELECT * 
        FROM trade
        WHERE 
            ((exporter IN (${countryMultiSQLList}) AND importer IN (${partnersMultiSQLList})) OR 
            (importer IN (${countryMultiSQLList}) AND exporter IN (${partnersMultiSQLList}))) 
            AND year BETWEEN ? AND ?
    ),
    unpivoted AS (
        SELECT year, exporter, importer, category, value
        FROM filtered
        UNPIVOT (value FOR category IN (${unpivotColumns}))
    ),
    exports AS (
        SELECT year, 
               country,
               category, 
               SUM(value) AS exports
        FROM (
            SELECT year, importer, category, value, 
                   unnest(ARRAY[ ${caseStatement("importer")} ]) AS country
            FROM unpivoted
            WHERE exporter IN (${countryMultiSQLList}) 
            AND importer IN (${partnersMultiSQLList})
        ) expanded
        WHERE country IS NOT NULL
        GROUP BY year, country, category
    ),
    imports AS (
        SELECT year, 
               country,
               category, 
               SUM(value) AS imports
        FROM (
            SELECT year, exporter, category, value, 
                   unnest(ARRAY[ ${caseStatement("exporter")} ]) AS country
            FROM unpivoted
            WHERE importer IN (${countryMultiSQLList}) 
            AND exporter IN (${partnersMultiSQLList})
        ) expanded
        WHERE country IS NOT NULL
        GROUP BY year, country, category
    ),
    trade_data AS (
        SELECT 
            COALESCE(e.year, i.year) AS year,
            COALESCE(e.country, i.country) AS country,
            COALESCE(e.category, i.category) AS category,
            ${flowColumn} AS ${flowMulti}
        FROM exports e
        FULL OUTER JOIN imports i
        ON e.year = i.year 
        AND e.country = i.country 
        AND e.category = i.category 
            GROUP BY COALESCE(e.year, i.year), 
                     COALESCE(e.country, i.country), 
                     COALESCE(e.category, i.category)
    )
    SELECT
        t.year,
        t.country,
        t.category,
        (t.${flowMulti} * c.${currencyColumnMulti}) AS ${flowMulti}
    FROM trade_data t
    LEFT JOIN conversion_table c
    ON t.year = c.year;
`;

const queryMultiParams = [timeRangeMulti[0], timeRangeMulti[1]];

const queryMulti = await db.query(queryMultiString, queryMultiParams);
```

```js
const viewSelection = Mutable("Single")
const selectSingle = () => viewSelection.value = "Single";
const selectMulti = () => viewSelection.value = "Multi";
const selectMethodology = () => viewSelection.value = "Methodology"
```

```js
// const moreSettingsSingle = Mutable(false)
// const showMoreSettingsSingle = () => {
//     moreSettingsSingle.value = !moreSettingsSingle.value;
// };
//
// const moreSettingsMulti = Mutable(false)
// const showMoreSettingsMulti = () => {
//     moreSettingsMulti.value = !moreSettingsMulti.value;
// };
```

```html
<div class="header card">
    <div class="view-button ${viewSelection === 'Single' ? 'active' : ''}">
        ${Inputs.button("Single Country", {reduce: selectSingle})}
    </div>
    <div class="view-button ${viewSelection === 'Multi' ? 'active' : ''}">
        ${Inputs.button("Multi Country", {reduce: selectMulti})}
    </div>
    <div class="view-button ${viewSelection === 'Methodology' ? 'active' : ''}">
        ${Inputs.button("Methodology", {reduce: selectMethodology})}
    </div>
</div>


<div class="view-box ${viewSelection === 'Single' ? 'active' : ''}">

    <div class="card settings">
        <div class="settings-group">
            ${countrySingleInput}
            ${partnerSingleInput}
        </div>
        <div class="settings-group">
            ${currencySingleInput}
        </div>
        <div class="settings-group">
            ${pricesSingleInput}
            ${timeRangeSingleInput}
        </div>
    </div>

    <div class="grid grid-cols-2">
        
        <div class="card">
            <div class="plot-container" id="single-plot">
                <h2 class="plot-title">
                    ${`Trade between ${countrySingle === "Dem. Rep. of the Congo" ? "DRC" : countrySingle} and ${partnerSingle}`}
                </h2>
                <h3 class="plot-subtitle">
                    <span class="export-subtitle-label">Exports</span>,
                    <span class="import-subtitle-label">imports</span> and
                    <span class="balance-subtitle-label">trade balance</span>
                </h3>
                ${resize((width) =>
                    plotSingle(querySingle, currencySingle, width)
                )}
                <div class="bottom-panel">
                    <div class="text-section">
                        <p class="plot-source">Source: Gaulier and Zignago (2010) <a href="https://cepii.fr/CEPII/en/bdd_modele/bdd_modele_item.asp?id=37" target="_blank" rel="noopener noreferrer">BACI Database</a>. CEPII</p>
                        <p class="plot-note">Exports refer to the total value of goods exported from ${countrySingle} to ${partnerSingle}</p>
                    </div>
                    <div class="logo-section">
                        <a href="https://data.one.org/" target="_blank">
                            <img src=${oneLogo} alt="A black circle with ONE written in white thick letters.">
                        </a>
                    </div>
                </div>
            </div>
            <div class="download-panel">
                ${Inputs.button(
                    "Download plot", {
                        reduce: () => downloadPNG(
                            'single-plot',
                                formatString(
                                    `Trade between ${countrySingle === "Dem. Rep. of the Congo" ? "DRC" : countrySingle} and ${partnerSingle}`,
                                    { capitalize: false, fileMode: true }
                                )
                        )
                    }
                )}
            </div>
        </div>

        <div class="card">
            <div class="plot-container" id="single-table">
                <h2 class="table-title">
                    ${`Trade between ${countrySingle === "Dem. Rep. of the Congo" ? "DRC" : countrySingle} and ${partnerSingle}`}
                </h2>
                <h3 class="table-subtitle">
                    By product category,  ${timeRangeSingle[0] === timeRangeSingle[1] ? timeRangeSingle[0] : `${timeRangeSingle[0]}-${timeRangeSingle[1]}`}
                </h3>
                ${resize((width) =>
                    tableSingle(querySingle, width)
                )}
                <div class="bottom-panel">
                    <div class="text-section">
                        <p class="plot-source">Source: Gaulier and Zignago (2010) <a href="https://cepii.fr/CEPII/en/bdd_modele/bdd_modele_item.asp?id=37" target="_blank" rel="noopener noreferrer">BACI Database</a>. CEPII</p>
                        <p class="plot-note">Exports refer to the total value of goods exported from ${countrySingle} to ${partnerSingle}</p>
                    </div>
                    <div class="logo-section">
                        <a href="https://data.one.org/" target="_blank">
                            <img src=${oneLogo} alt="A black circle with ONE written in white thick letters.">
                        </a>
                    </div>
                </div>
            </div>
            <div class="download-panel">
                ${Inputs.button(
                "Download data", {
                reduce: () => downloadXLSX(
                querySingle,
                formatString(
                `Trade between ${countrySingle === "Dem. Rep. of the Congo" ? "DRC" : countrySingle} and ${partnerSingle}`,
                { capitalize: false, fileMode: true }
                )
                )
                }
                )}
            </div>
        </div>
        
    </div>
    
</div>


<div class="view-box ${viewSelection === 'Multi' ? 'active' : ''}">

    <div class="card settings">
        <div class="settings-group">
            ${countryMultiInput}
            ${partnersMultiInput}
        </div>
        <div class="settings-group">
            ${currencyMultiInput}
            ${flowMultiInput}
        </div>
        <div class="settings-group">
            ${pricesMultiInput}
            ${timeRangeMultiInput}
        </div>
    </div>

    <div class="grid grid-cols-2">
        
        <div class="card">
            <div  class="plot-container" id="multi-plot">
                <h2 class="plot-title">
                    ${formatString(flowMulti, {inSentence: true, capitalize: true})} ${countryMulti}
                </h2>
                <h3 class="plot-subtitle">
                    ${
                        flowMulti === "exports"
                            ? "to selected trading partners"
                            : flowMulti === "imports"
                                ? "from selected trading partners"
                                : "Selected trading partners"
                    }
                </h3>
                ${resize((width) =>
                    plotMulti(queryMulti, currencyMulti, width)
                )}
                <div class="bottom-panel">
                    <div class="text-section">
                        <p class="plot-source">Source: Gaulier and Zignago (2010) <a href="https://cepii.fr/CEPII/en/bdd_modele/bdd_modele_item.asp?id=37" target="_blank" rel="noopener noreferrer">BACI Database</a>. CEPII</p>
                    </div>
                    <div class="logo-section">
                        <a href="https://data.one.org/" target="_blank">
                            <img src=${oneLogo} alt="A black circle with ONE written in white thick letters.">
                        </a>
                    </div>
                </div>
            </div>
            <div class="download-panel">
                ${Inputs.button(
                    "Download plot", {
                        reduce: () => downloadPNG(
                            'multi-plot',
                            formatString(flowMulti + countryMulti, {inSentence: true, capitalize: false, fileMode: true})
                        )
                    }
                )}
            </div>
        </div>

        <div class="card">
            <div class="plot-container" id="multi-table">
                <h2 class="table-title">
                    ${formatString(flowMulti, {inSentence: true, capitalize: true})} ${countryMulti}
                </h2>
                <h3 class="table-subtitle">
                    By product category,  ${timeRangeMulti[0] === timeRangeMulti[1] ? timeRangeMulti[0] : `${timeRangeMulti[0]}-${timeRangeMulti[1]}`}
                </h3>
                ${resize((width) =>
                    tableMulti(queryMulti, width)
                )}
                <div class="bottom-panel">
                    <div class="text-section">
                        <p class="plot-source">Source: Gaulier and Zignago (2010) <a href="https://cepii.fr/CEPII/en/bdd_modele/bdd_modele_item.asp?id=37" target="_blank" rel="noopener noreferrer">BACI Database</a>. CEPII</p>
                    </div>
                    <div class="logo-section">
                        <a href="https://data.one.org/" target="_blank">
                            <img src=${oneLogo} alt="A black circle with ONE written in white thick letters.">
                        </a>
                    </div>
                </div>
            </div>
            <div class="download-panel">
                ${Inputs.button(
                    "Download data", {
                        reduce: () => downloadXLSX(
                            queryMulti,
                            formatString(flowMulti + countryMulti, {inSentence: true, capitalize: false, fileMode: true})
                        )
                    }
                )}
            </div>
        </div>
        
    </div>
        
</div>


<div class="view-box ${viewSelection === 'Methodology' ? 'active' : ''}">
    
    <div class="card">
        <p>
            Trade data in current USD comes from CEPII's
            <a href="https://cepii.fr/CEPII/en/bdd_modele/bdd_modele_item.asp?id=37">
                BACI database
            </a>.
            This data is then grouped by product categories according to
            <a href="https://www.wcoomd.org/en/topics/nomenclature/instrument-and-tools/hs-nomenclature-2022-edition/hs-nomenclature-2022-edition.aspx">HS Nomenclature</a>,
            such that each section constitutes a category.
        </p>

        <p>
            To convert figures into 2015 constant USD, we use GDP deflators and exchange rates from the IMF World Economic Outlook through the <a href="https://github.com/jm-rivera/pydeflate">pydeflate</a> package.
        </p>

        <p>
            Figures expressed as a percentage of GDP are calculated by dividing the trade value (in 2015 constant USD) by the GDP (also in 2015 constant USD) for that specific year and country. GDP figures are taken from the World Economic Outlook via the <a href="https://github.com/ONEcampaign/bblocks_data_importers">bblocks_data_importers</a> package and converted from current to 2015 constant USD using pydeflate.
        </p>

        <p>
            The scripts to wrangle the data are included in the <span style="font-family: monospace">data_preparation</span> directory of the project's <a href="https://github.com/ONEcampaign/trade_data_explorer">GitHub repo</a>.
        </p>
    </div>
    
</div>

```