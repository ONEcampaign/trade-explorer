```js
import {DuckDBClient} from "npm:@observablehq/duckdb";

import {setCustomColors} from "./components/colors.js"
import {getUnitLabel, formatString, generateTitleMulti, generateSubtitle, generateNote, generateFileName} from "./components/utils.js"
import {timeRange, categories, groupMappings} from "./components/inputValues.js";

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
const db = DuckDBClient.of({
    trade: FileAttachment("./data/scripts/trade.parquet"),
    current_conversion_table: FileAttachment("./data/scripts/current_conversion_table.csv"),
    constant_conversion_table: FileAttachment("./data/scripts/constant_conversion_table.csv"),
    gdp_table: FileAttachment("./data/scripts/gdp_table.csv"),
});
```

```js
// USER INPUTS

const countries = Object.keys(groupMappings)
const groups = Object.values(groupMappings)

// Country Input
const countryMultiInput = Inputs.select(
    countries,
    {
        label: "Country",
        sort: true,
        value: "Kenya"
    })

const partnersMultiInput = multiSelect(
    countries,
    {
        label: "Partner(s)",
        value: ["Canada"]
    })

function updateOptionsMulti() {

    const countryList = groupMappings[countryMultiInput.value]
    const partnerList = partnersMultiInput.value.flatMap(group => groupMappings[group] || [group]);
    if (countryList.some(country => partnerList.includes(country))) {
        partnersMultiInput.value = countries
            .filter(group => {
                let elements = groupMappings[group] || [group];
                return !elements.some(country => countryList.includes(country));
            })
            // Pick 5 random items that don't overlap
            .sort(() => Math.random() - 0.5)
            .slice(0, 5);
    }

    for (const o of partnersMultiInput.querySelectorAll("option")) {
        const groupList = groupMappings[o.value]
        if (groupList.some(item => countryList.includes(item))) {
            o.setAttribute("disabled", "disabled");
        } else o.removeAttribute("disabled");
    }

    for (const o of countryMultiInput.querySelectorAll("option")) {
        const groupList = groups[o.value]
        if (groupList.some(item => partnerList.includes(item))) {
            o.setAttribute("disabled", "disabled");
        } else o.removeAttribute("disabled");
    }

}

updateOptionsMulti();
countryMultiInput.addEventListener("input", updateOptionsMulti);
partnersMultiInput.addEventListener("input", updateOptionsMulti);

const countryMulti = Generators.input(countryMultiInput);
const partnersMulti = Generators.input(partnersMultiInput);

// Unit Input
const unitMultiInput = Inputs.select(
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
const unitMulti = Generators.input(unitMultiInput)

// Flow input
const flowMultiInput = Inputs.select(
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

// Category Input
const categoryMultiInput = Inputs.select(
    ["All", ...categories], {
        label: "Category",
        value: "All"
    }
);
const categoryMulti = Generators.input(categoryMultiInput)

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

//  MULTI COUNTRY VIEW

const countryMultiList = getCountryList(countryMulti);
const partnersMultiList = getCountryList(partnersMulti);

const countryMultiSQLList = countryMultiList.map(escapeSQL).map(c => `'${c}'`).join(", ");
const partnersMultiSQLList = partnersMultiList.length > 0
    ? partnersMultiList.map(escapeSQL).map(c => `'${c}'`).join(", ")
    : "'NO_MATCH'"; // Fallback value that will never match

const isGdpMulti = unitMulti === "gdp" ? true : false
const unitColumnMulti = isGdpMulti
    ? "usd_constant"
    : `${unitMulti}_${pricesMulti}`;
const conversionTableMulti = isGdpMulti
    ? "constant_conversion_table"
    : `${pricesMulti}_conversion_table`

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
            AND year BETWEEN ${timeRangeMulti[0]} AND ${timeRangeMulti[1]}
    ),
    unpivoted AS (
        SELECT year, exporter, importer, category, value
        FROM filtered
        UNPIVOT (value FOR category IN (${categoryMulti === "All" ? unpivotColumns : `'${categoryMulti}'`}))
    ),
    exports AS (
        SELECT year, partner, category, SUM(exports) AS exports
        FROM (
            SELECT u.year, u.category, SUM(u.value * c.factor) AS exports, 
                   unnest(ARRAY[ ${caseStatement("u.importer")} ]) AS partner
            FROM unpivoted u
            JOIN conversion c 
                ON u.year = c.year
                ${pricesMulti === "constant" | isGdpMulti ? "AND u.exporter = c.country" : ""} 
            WHERE u.exporter IN (${countryMultiSQLList}) 
            AND u.importer IN (${partnersMultiSQLList})
            GROUP BY u.year, u.importer, u.category
        ) expanded
        WHERE partner IS NOT NULL
        GROUP BY year, partner, category
    ),
    imports AS (
        SELECT year, partner, category, SUM(imports) AS imports
        FROM (
            SELECT u.year, u.category, SUM(u.value * c.factor * 1.1 / 1.1) AS imports, -- Multipliying and diving by the same number other than 1 converts from Uint1Array to float
                   unnest(ARRAY[ ${caseStatement("u.exporter")} ]) AS partner
            FROM unpivoted u
            JOIN conversion c 
                ON u.year = c.year
                ${pricesMulti === "constant" | isGdpMulti ? "AND u.importer = c.country" : ""} 
            WHERE u.importer IN (${countryMultiSQLList}) 
            AND u.exporter IN (${partnersMultiSQLList})
            GROUP BY u.year, u.exporter, u.category
        ) expanded
        WHERE partner IS NOT NULL
        GROUP BY year, partner, category
    ),
    conversion AS (
        SELECT year, ${pricesMulti === "constant" | isGdpMulti ? "country," : ""} ${unitColumnMulti} AS factor 
        FROM ${conversionTableMulti}
        ${pricesMulti === "constant" | isGdpMulti ? `WHERE country IN (${countryMultiSQLList})` : ""}
    ),
    gdp AS (
        SELECT year, SUM(gdp_constant) AS gdp
        FROM gdp_table
        WHERE country IN (${countryMultiSQLList})
        GROUP BY year
    )
    SELECT 
        COALESCE(e.year, i.year) AS year,
        '${escapeSQL(countryMulti)}' AS country,
        COALESCE(e.partner, i.partner) AS partner,
        COALESCE(e.category, i.category) AS category,
        SUM(COALESCE(e.exports, 0)) AS exports,
        SUM(COALESCE(i.imports, 0)) * -1 AS imports,
        (SUM(COALESCE(e.exports, 0)) - SUM(COALESCE(i.imports, 0))) AS balance,
        g.gdp AS gdp,
        CASE 
            WHEN ${isGdpMulti} THEN 'share of gdp'
            ELSE '${pricesMulti} ${unitMulti} million'
        END AS unit          
    FROM exports e
    FULL OUTER JOIN imports i
    ON e.year = i.year 
        AND e.partner = i.partner 
        AND e.category = i.category 
    LEFT JOIN gdp g
        ON COALESCE(e.year, i.year) = g.year
        GROUP BY COALESCE(e.year, i.year), 
                 COALESCE(e.partner, i.partner), 
                 COALESCE(e.category, i.category),
                 g.gdp
`;

const queryMulti = await db.query(queryMultiString);

const dataMulti = queryMulti.toArray()
    .map((row) => ({
        ...row
    }))

const isPartnersMulti = partnersMulti.length > 1 ? true : false
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
        ${countryMultiInput}
        ${partnersMultiInput}
    </div>
    <div class="settings-group">
        ${unitMultiInput}
        ${categoryMultiInput}
    </div>
    <div class="settings-group">
        ${isGdpMulti ? html` ` : pricesMultiInput}
        ${timeRangeMultiInput}
        ${isPartnersMulti ? flowMultiInput : html` `}
    </div>
</div>
${ 
    partnersMulti.length === 0 
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
                    ${generateTitleMulti(countryMulti, partnersMulti, flowMulti)}
                    ${generateSubtitle(partnersMulti, flowMulti, timeRangeMulti, {table: false})}
                    ${
                        resize(
                            (width) => tradePlot(dataMulti, flowMulti, width)
                        )
                    }
                    <div class="bottom-panel">
                        <div class="text-section">
                            ${generateNote(unitMulti, pricesMulti, countryMulti, partnersMulti, flowMulti)}
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
                                    generateFileName(countryMulti, timeRangeMulti, partnersMulti, flowMulti, {png: true})
                                )
                            }
                        )
                    }
                </div>
            </div>
            <div class="card">
                <div class="plot-container" id="multi-table">
                        ${generateTitleMulti(countryMulti, partnersMulti, flowMulti)}
                        ${generateSubtitle(partnersMulti, flowMulti, timeRangeMulti, {table: true})}
                        ${resize((width) =>
                            tradeTable(dataMulti, flowMulti, width)
                        )}
                        <div class="bottom-panel">
                            <div class="text-section">
                                ${generateNote(unitMulti, pricesMulti, countryMulti, partnersMulti, flowMulti)}
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
                                        dataMulti,
                                        generateFileName(countryMulti, timeRangeMulti, partnersMulti, flowMulti, {})
                                    )
                                }
                            )
                        }
                </div>
            </div>
        </div>
    `
}