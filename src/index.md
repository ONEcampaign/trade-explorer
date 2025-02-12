```js
import {DuckDBClient} from "npm:@observablehq/duckdb";

import {setCustomColors} from "./components/setCustomColors.js";

import {timeRange, categories, groupMappings} from "./components/inputValues.js";

import {rangeInput} from "./components/rangeInput.js";

import {formatString} from "./components/formatString.js";
import {getUnitLabel} from "./components/getUnitLabel.js"

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
    trade: FileAttachment("./data/scripts/trade.parquet"),
    conversion_table: FileAttachment("./data/scripts/conversion_table.csv"),
    gdp_table: FileAttachment("./data/scripts/gdp_table.csv"),
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
        label: "Country",
        sort: true,
        value: "African countries"
    })

// Partner Input
const partnerSingleInput = Inputs.select(
    countries,
    {
        label: "Partner",
        sort: true,
        value: "France"
    }
);

function updateOptionsSingle() {
    
    const countryList = groupMappings[countrySingleInput.value]
    const partnerList = groupMappings[partnerSingleInput.value]
    if (countryList.some(country => partnerList.includes(country))) {
        let nonOverlapping = countries.find(group => {
            let elements = groupMappings[group] || [group];
            return !elements.some(country => countryList.includes(country));
        });
        partnerSingleInput.value = nonOverlapping
    } 
    for (const o of partnerSingleInput.querySelectorAll("option")) {
        const groupList = groups[o.value]
        if (countryList.some(item => groupList.includes(item))) {
            o.setAttribute("disabled", "disabled");
        }
        else o.removeAttribute("disabled");
    }

    for (const o of countrySingleInput.querySelectorAll("option")) {
        if (countries[o.value] === partnerSingleInput.value) {
            o.setAttribute("disabled", "disabled");
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
const unitSingleInput = Inputs.select(
    new Map([
        ["US Dollars", "usd"],
        ["Canada Dollars", "cad"],
        ["Euros", "eur"],
        ["British pounds", "gbp"],
        ["% of GDP", "gdp"]
    ]),
    {
        label: "Unit"
    }
);
const unitSingle = Generators.input(unitSingleInput)

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
        label: "Country",
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

    const countryList = groupMappings[countryMultiInput.value]
    const partnerList = partnersMultiInput.value.flatMap(group => groupMappings[group] || [group]);
    if (countryList.some(country => partnerList.includes(country))) {
        partnersMultiInput.value = countries.filter(group => {
            let elements = groupMappings[group] || [group];
            return !elements.some(country => countryList.includes(country));
        }).slice(0, 3);
    }
    
    for (const o of partnersMultiInput.querySelectorAll("option")) {        
        const groupList = groups[o.value]
        if (groupList.some(item => countryList.includes(item))) {
            o.setAttribute("disabled", "disabled");
        }
        else o.removeAttribute("disabled");
    }

    for (const o of countryMultiInput.querySelectorAll("option")) {
        if (countries[o.value] === partnersMultiInput.value) {
            o.setAttribute("disabled", "disabled");
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
const unitMultiInput = Inputs.select(
    new Map([
        ["US Dollars", "usd"],
        ["Canada Dollars", "cad"],
        ["Euros", "eur"],
        ["British pounds", "gbp"],
        ["% of GDP", "gdp"]
    ]),
    {
        label: "Currency",
        value: "gdp"
    }
);
const unitMulti = Generators.input(unitMultiInput)

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

const isGdpSingle = unitSingle === "gdp" ? true : false
const unitColumnSingle = isGdpSingle
    ? "usd_constant" 
    : `${unitSingle}_${pricesSingle}`;

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
    ),
    gdp AS (
        SELECT year, SUM (gdp_constant) AS gdp
        FROM gdp_table
        WHERE country in (${countrySingleSQLList}) 
        GROUP BY year
    )
    SELECT 
        t.year,
        t.category,
        '${escapeSQL(countrySingle)}' AS country,
        '${escapeSQL(partnerSingle)}' AS partner,
        (t.exports * c.${unitColumnSingle}) AS exports,
        (t.imports * c.${unitColumnSingle}) AS imports,
        (t.balance * c.${unitColumnSingle}) AS balance,
        g.gdp AS gdp,
        CASE 
            WHEN ${isGdpSingle} THEN 'share of gdp'
            ELSE '${pricesSingle} ${unitSingle} million'
        END AS unit
    FROM trade_data t
    LEFT JOIN conversion_table c
    ON t.year = c.year
    LEFT JOIN gdp g
    ON t.year = g.year
    ORDER BY t.year ASC, category ASC;
`;

const querySingleParams = [timeRangeSingle[0], timeRangeSingle[1]];

const querySingle = await db.query(querySingleString, querySingleParams);


//  MULTI COUNTRY VIEW

const countryMultiList = getCountryList(countryMulti);
const partnersMultiList = getCountryList(partnersMulti);

const countryMultiSQLList = countryMultiList.map(escapeSQL).map(c => `'${c}'`).join(", ");
const partnersMultiSQLList = partnersMultiList.map(escapeSQL).map(c => `'${c}'`).join(", ");

// Define currency column
const isGdpMulti = unitMulti === "gdp" ? true : false
const unitColumnMulti = isGdpMulti
    ? "usd_constant"
    : `${unitMulti}_${pricesMulti}`;

// Define flow column selection
const flowColumn = flowMulti === 'exports' 
    ? `COALESCE(SUM(e.exports), 0)` 
    : flowMulti === 'imports' 
        ? `COALESCE(SUM(i.imports), 0) * -1` 
        : `COALESCE(SUM(e.exports), 0) - COALESCE(SUM(i.imports), 0)` 

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
               partner,
               category, 
               SUM(value) AS exports
        FROM (
            SELECT year, importer, category, value, 
                   unnest(ARRAY[ ${caseStatement("importer")} ]) AS partner
            FROM unpivoted
            WHERE exporter IN (${countryMultiSQLList}) 
            AND importer IN (${partnersMultiSQLList})
        ) expanded
        WHERE partner IS NOT NULL
        GROUP BY year, partner, category
    ),
    imports AS (
        SELECT year, 
               partner,
               category, 
               SUM(value) AS imports
        FROM (
            SELECT year, exporter, category, value, 
                   unnest(ARRAY[ ${caseStatement("exporter")} ]) AS partner
            FROM unpivoted
            WHERE importer IN (${countryMultiSQLList}) 
            AND exporter IN (${partnersMultiSQLList})
        ) expanded
        WHERE partner IS NOT NULL
        GROUP BY year, partner, category
    ),
    trade_data AS (
        SELECT 
            COALESCE(e.year, i.year) AS year,
            COALESCE(e.partner, i.partner) AS partner,
            COALESCE(e.category, i.category) AS category,
            COALESCE(SUM(e.exports), 0) AS exports,
            COALESCE(SUM(i.imports), 0) * -1 AS imports,
            COALESCE(SUM(e.exports), 0) - COALESCE(SUM(i.imports), 0) AS balance
        FROM exports e
        FULL OUTER JOIN imports i
        ON e.year = i.year 
        AND e.partner = i.partner 
        AND e.category = i.category 
            GROUP BY COALESCE(e.year, i.year), 
                     COALESCE(e.partner, i.partner), 
                     COALESCE(e.category, i.category)
    ),
    gdp AS (
        SELECT year, SUM (gdp_constant) AS gdp
        FROM gdp_table
        WHERE country in (${countryMultiSQLList}) 
        GROUP BY year
    )
    SELECT
        t.year,
        '${escapeSQL(countryMulti)}' AS country,
        t.partner,
        t.category,
        (t.exports * c.${unitColumnMulti}) AS exports,
        (t.imports * c.${unitColumnMulti}) AS imports,
        (t.balance * c.${unitColumnMulti}) AS balance,
        g.gdp AS gdp,
        CASE 
            WHEN ${isGdpMulti} THEN 'share of gdp'
            ELSE '${pricesMulti} ${unitMulti} million'
        END AS unit
    FROM trade_data t
    LEFT JOIN conversion_table c
    ON t.year = c.year    
    LEFT JOIN gdp g
    ON t.year = g.year
    ORDER BY t.year ASC, category ASC, partner ASC;
`;

const queryMultiParams = [timeRangeMulti[0], timeRangeMulti[1]];

const queryMulti = await db.query(queryMultiString, queryMultiParams);
```

```js
const viewSelection = Mutable("Single")
const selectSingle = () => viewSelection.value = "Single";
const selectMulti = () => viewSelection.value = "Multi";
const selectAbout = () => viewSelection.value = "About"
```

```html
<div class="title-container">
    <div class="title-logo">
        <a href="https://data.one.org/" target="_blank">
            <img src=${oneLogo} alt="A black circle with ONE written in white thick letters.">
        </a>
    </div>
    <h1 class="title-text">
        Trade explorer
    </h1>
</div>


<div class="header card">
    <div class="view-button ${viewSelection === 'Single' ? 'active' : ''}">
        ${Inputs.button("Single Country", {reduce: selectSingle})}
    </div>
    <div class="view-button ${viewSelection === 'Multi' ? 'active' : ''}">
        ${Inputs.button("Multi Country", {reduce: selectMulti})}
    </div>
    <div class="view-button ${viewSelection === 'About' ? 'active' : ''}">
        ${Inputs.button("About", {reduce: selectAbout})}
    </div>
</div>

<div class="view-box ${viewSelection === 'Single' ? 'active' : ''}">

    <div class="card settings">
        <div class="settings-group">
            ${countrySingleInput}
            ${partnerSingleInput}
        </div>
        <div class="settings-group">
            ${unitSingleInput}
            ${isGdpSingle ? html`` : pricesSingleInput}
        </div>
        <div class="settings-group">
            ${timeRangeSingleInput}
        </div>
    </div>

    <div class="grid grid-cols-2">
        
        <div class="card">
            <div class="plot-container" id="single-plot">
                <h2 class="plot-title">
                    ${`Trade between ${countrySingle} and ${partnerSingle}`}
                </h2>
                <h3 class="plot-subtitle">
                    <span class="export-subtitle-label">Exports</span>,
                    <span class="import-subtitle-label">imports</span> and
                    <span class="balance-subtitle-label">trade balance</span>
                </h3>
                ${resize((width) =>
                    plotSingle(querySingle, width)
                )}
                <div class="bottom-panel">
                    <div class="text-section">
                        <p class="plot-source">Source: Gaulier and Zignago (2010) <a href="https://cepii.fr/CEPII/en/bdd_modele/bdd_modele_item.asp?id=37" target="_blank" rel="noopener noreferrer">BACI Database</a>. CEPII</p>
                        <p class="plot-note">
                            ${
                                isGdpSingle
                                ? html`<span>All values as percentage of ${countrySingle}'s GDP.</span>`
                                : pricesSingle === "constant" 
                                    ? html`<span>All values in constant 2023 ${getUnitLabel(unitSingle, {})}.</span>`
                                    : html`<span>All values in current ${getUnitLabel(unitSingle, {})}.</span>`
                            }
                            <span>Exports refer to the value of goods traded from ${countrySingle} to ${partnerSingle}.</span>
                        </p>
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
                                    `Trade between ${countrySingle} and ${partnerSingle}`,
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
                    ${`Trade between ${countrySingle} and ${partnerSingle}`}
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
                        <p class="plot-note">
                            ${
                                isGdpSingle
                                ? html`<span>All values as percentage of ${countrySingle}'s GDP.</span>`
                                : pricesSingle === "constant"
                                    ? html`<span>All values in constant 2023 ${getUnitLabel(unitSingle, {})}.</span>`
                                    : html`<span>All values in current ${getUnitLabel(unitSingle, {})}.</span>`
                            }
                            <span>Exports refer to the value of goods traded from ${countrySingle} to ${partnerSingle}.</span>
                        </p>                 
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
                                `trade between ${countrySingle} and ${partnerSingle}`,
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
            ${unitMultiInput}
            ${isGdpMulti ? html`` : pricesMultiInput}
        </div>
        <div class="settings-group">
            ${timeRangeMultiInput}
            ${flowMultiInput}
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
                    plotMulti(queryMulti, flowMulti, width)
                )}
                <div class="bottom-panel">
                    <div class="text-section">
                        <p class="plot-source">Source: Gaulier and Zignago (2010) <a href="https://cepii.fr/CEPII/en/bdd_modele/bdd_modele_item.asp?id=37" target="_blank" rel="noopener noreferrer">BACI Database</a>. CEPII</p>
                        <p class="plot-note">
                            ${
                                isGdpMulti
                                ? html`<span>All values as percentage of ${countryMulti}'s GDP.</span>`
                                : pricesSingle === "constant"
                                    ? html`<span>All values in constant 2023 ${getUnitLabel(unitMulti, {})}.</span>`
                                    : html`<span>All values in current ${getUnitLabel(unitMulti, {})}.</span>`
                            }
                            ${
                                flowMulti === "exports"
                                ? html`<span>Exports refer to the value of goods traded from ${countryMulti} to the selected partners.</span>`
                                : flowMulti === "imports"
                                    ? html`<span>Imports refer to the value of goods traded from the selected partners to ${countryMulti}.</span>`
                                    : html`<span>A positive trade balance indicates ${countryMulti}'s exports to a partner exceed its imports from that partner.</span>`
                            }
                        </p>
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
                            formatString(flowMulti + " " + countryMulti, {inSentence: true, capitalize: false, fileMode: true})
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
                    tableMulti(queryMulti, flowMulti, width)
                )}
                <div class="bottom-panel">
                    <div class="text-section">
                        <p class="plot-source">Source: Gaulier and Zignago (2010) <a href="https://cepii.fr/CEPII/en/bdd_modele/bdd_modele_item.asp?id=37" target="_blank" rel="noopener noreferrer">BACI Database</a>. CEPII</p>
                        <p class="plot-note">
                            ${
                                isGdpMulti
                                ? html`<span>All values as percentage of ${countryMulti}'s GDP.</span>`
                                : pricesSingle === "constant"
                                    ? html`<span>All values in constant 2023 ${getUnitLabel(unitMulti, {})}.</span>`
                                    : html`<span>All values in current ${getUnitLabel(unitMulti, {})}.</span>`
                            }
                            ${
                                flowMulti === "exports"
                                ? html`<span>Exports refer to the value of goods traded from ${countryMulti} to the selected partners.</span>`
                                : flowMulti === "imports"
                                    ? html`<span>Imports refer to the value of goods traded from the selected partners to ${countryMulti}.</span>`
                                    : html`<span>A positive trade balance indicates ${countryMulti}'s exports to a partner exceed its imports from that partner.</span>`
                            }
                        </p>
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
                            formatString("trade with " + countryMulti, {inSentence: true, capitalize: false, fileMode: true})
                        )
                    }
                )}
            </div>
        </div>
        
    </div>
        
</div>


<div class="view-box ${viewSelection === 'About' ? 'active' : ''}">
    
    <div class="card methodology">
        
        <h2 class="section-header">
            How to use
        </h2>
        
        <p class="normal-text">
            The tool provides two different views for exploring international trade data. <span class="italic-span">Single Country</span> allows you to explore trade between a selected country and a single trading partner. <span class="italic-span">Multi Country</span> lets you compare a country’s trade with multiple partners simultaneously.
        </p>

        <p class="normal-text">
            Begin by selecting a country or group from the <span class="italic-span">Country</span> dropdown menu. All trade figures are presented from the selected country’s perspective. For example, if you choose Botswana, exports represent goods and services flowing out of Botswana to the selected partner, while imports represent inflows into Botswana. In this sense, exports are displayed as positive values, indicating revenue from outgoing goods and services, while imports are shown as negative values, reflecting expenditures on incoming goods and services.
        </p>
        
        <p class="normal-text">
            In <span class="italic-span">Multi Country</span>, you can select multiple trading partners by dragging or Shift-clicking, and select/deselect an individual partner by Command-clicking. Since this view presents multiple countries, you can only visualize a single trade flow (either exports, imports or trade balance) at once, allowing for clearer comparisons across partners.
        </p>
        
        <h2 class="section-header">
            Methodology
        </h2>

        <p class="normal-text">
            Trade data is retrieved from CEPII's
            <a href="https://cepii.fr/CEPII/en/bdd_modele/bdd_modele_item.asp?id=37">BACI database</a>,
            and grouped by product category according to
            <a href="https://www.wcoomd.org/en/topics/nomenclature/instrument-and-tools/hs-nomenclature-2022-edition/hs-nomenclature-2022-edition.aspx">HS Nomenclature</a>,
            with each section forming a category.
        </p>

        <p class="normal-text">
            The original trade figures are presented in current US$. We use the <a href="https://github.com/jm-rivera/pydeflate">pydeflate</a> package to convert them into other currencies and constant prices.
        </p>

        <p class="normal-text">
            Figures expressed as a percentage of GDP are calculated by dividing the trade value (in 2015 constant USD) by the GDP (also in 2015 constant USD) for that specific year and country. GDP figures are taken from the World Economic Outlook via the <a href="https://github.com/ONEcampaign/bblocks_data_importers">bblocks_data_importers</a> package and converted from current to 2015 constant USD using pydeflate.
        </p>

        <p class="normal-text">
            The data preparation scripts are located in the <span style="font-family: monospace">src/data</span> directory of the project's <a href="https://github.com/ONEcampaign/trade_data_explorer">GitHub repository</a>.
        </p>

        <h2 class="section-header">
            Country groups
        </h2>

        <ul class="group-list">
            ${
            Object.entries(groupMappings)
            .filter(([_, countries]) => countries.length > 1)
            .sort(([a], [b]) => a.localeCompare(b)) // Sort alphabetically by group name
            .map(([group, countries]) => html`<li><span class="group-name" ">${group}</span>: ${countries.join(", ")}.</li>`)
            }
        </ul>

        <h2 class="section-header">
            Contact
        </h2>

        <p class="normal-text">
            For questions or suggestions, please contact miguel.haroruiz[at]one[dot]org
        </p>
        
    </div>
    
</div>
```