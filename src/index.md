```js
import {DuckDBClient} from "npm:@observablehq/duckdb";

import {setCustomColors} from "./components/colors.js"
import {getUnitLabel, formatString, generateTitleSingle, generateSubtitle, generateNote} from "./components/utils.js"
import {timeRange, categories, groupMappings} from "./components/inputValues.js";

import {rangeInput} from "./components/rangeInput.js";

import {topPartnersTable} from "./components/visuals.js";

// import {downloadPNG, downloadXLSX} from './components/downloads.js';
```

```js 
setCustomColors();
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
const countrySingleInput = Inputs.select(
    countries,
    {
        label: "Country",
        sort: true,
        value: "Algeria"
    })

const countrySingle = Generators.input(countrySingleInput);

// Unit Input
const unitSingleInput = Inputs.select(
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
const unitSingle = Generators.input(unitSingleInput)

// Flow input
const flowSingleInput = Inputs.radio(
    new Map([
        ["Exports", "exports"],
        ["Imports", "imports"]
    ]),
    {
        label: "Trade flow",
        value: "exports"
    }
)
const flowSingle = Generators.input(flowSingleInput)

// Category Input
const categorySingleInput = Inputs.select(
    ["All", ...categories], {
        label: "Category",
        value: "All"
    }
);
const categorySingle = Generators.input(categorySingleInput)

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

const countrySingleSQLList = countrySingleList
    .map(c => `'${escapeSQL(c)}'`)
    .join(", ");

const isGdpSingle = unitSingle === "gdp" ? true : false;
const unitColumnSingle = isGdpSingle
    ? "usd_constant"
    : `${unitSingle}_${pricesSingle}`;
const conversionTableSingle = isGdpSingle
    ? "constant_conversion_table"
    : `${pricesSingle}_conversion_table`

// Top trading partners
const queryTopPartnersString = `
    WITH filtered AS (
        SELECT * 
        FROM trade
        WHERE 
            (${flowSingle === "exports" ? "exporter" : "importer"} IN (${countrySingleSQLList}) 
            AND ${flowSingle === "exports" ? "importer" : "exporter"} NOT IN (${countrySingleSQLList}))
            AND year BETWEEN ${timeRangeSingle[0]} AND ${timeRangeSingle[1]}
    ),
    unpivoted AS (
        SELECT year, exporter, importer, category, value
        FROM filtered
        UNPIVOT (value FOR category IN (${categorySingle === "All" ? unpivotColumns : `'${categorySingle}'`}))
    ),
    conversion AS (
        SELECT 
            year, 
            ${pricesSingle === "constant" | isGdpSingle ? "country AS country," : ""}
            ${unitColumnSingle} AS factor
        FROM ${conversionTableSingle}
        ${pricesSingle === "constant" | isGdpSingle ? `WHERE country IN (${countrySingleSQLList})` : ""}
    ),
    gdp AS (
        SELECT SUM(gdp_constant) AS gdp
        FROM gdp_table
        WHERE country IN (${countrySingleSQLList})
        AND year BETWEEN ${timeRangeSingle[0]} AND ${timeRangeSingle[1]}
    ),
    converted AS (
        SELECT 
            u.year,
            u.exporter,
            u.importer,
            SUM(u.value * c.factor * 1.1 / 1.1) AS converted_value
        FROM unpivoted u
        JOIN conversion c 
            ON u.year = c.year
            ${
                pricesSingle === "constant" | isGdpSingle 
                ?
                `AND (
                                (u.exporter = c.country AND u.exporter IN (${countrySingleSQLList})) 
                                OR 
                                (u.importer = c.country AND u.importer IN (${countrySingleSQLList}))
                            )`
                : ""}
        GROUP BY u.year, u.exporter, u.importer
    ),
    aggregated AS (
        SELECT 
            ${flowSingle === "exports" ? "importer" : "exporter"} AS partner, 
            '${flowSingle}' AS flow, 
            SUM(converted_value) AS total_value
        FROM converted
        WHERE ${flowSingle === "exports" ? "exporter" : "importer"} IN (${countrySingleSQLList}) 
        GROUP BY ${flowSingle === "exports" ? "importer" : "exporter"}
    )
    SELECT 
        '${escapeSQL(countrySingle)}' AS country,
        a.partner, 
        a.flow, 
        ${
            isGdpSingle    
            ? "CASE WHEN a.flow = 'imports' THEN -1 * (a.total_value / g.gdp * 100) ELSE (a.total_value / g.gdp * 100) END AS value"
            : "CASE WHEN a.flow = 'imports' THEN -1 * a.total_value ELSE a.total_value END AS value"
        }
    FROM aggregated a
    CROSS JOIN gdp g;
`;


const queryTopPartners = await db.query(queryTopPartnersString);

const dataTopPartners = queryTopPartners.toArray()
    .map((row) => ({
        ...row
    }))

// Top categories traded
const queryTopCategoriesString = `
    WITH filtered AS (
        SELECT * 
        FROM trade
        WHERE 
            (${flowSingle === "exports" ? "exporter" : "importer"} IN (${countrySingleSQLList}) 
            AND ${flowSingle === "exports" ? "importer" : "exporter"} NOT IN (${countrySingleSQLList}))
            AND year BETWEEN ${timeRangeSingle[0]} AND ${timeRangeSingle[1]}
    ),
    unpivoted AS (
        SELECT year, exporter, importer, category, value
        FROM filtered
        UNPIVOT (value FOR category IN (${unpivotColumns}))
    ),
    conversion AS (
        SELECT 
            year, 
            ${pricesSingle === "constant" | isGdpSingle ? "country AS country," : ""}
            ${unitColumnSingle} AS factor
        FROM ${conversionTableSingle}
        ${pricesSingle === "constant" | isGdpSingle ? `WHERE country IN (${countrySingleSQLList})` : ""}
    ),
    gdp AS (
        SELECT SUM(gdp_constant) AS gdp
        FROM gdp_table
        WHERE country IN (${countrySingleSQLList})
        AND year BETWEEN ${timeRangeSingle[0]} AND ${timeRangeSingle[1]}
    ),
    converted AS (
        SELECT 
            u.year,
            u.exporter,
            u.importer,
            u.category,
            SUM(u.value * c.factor * 1.1 / 1.1) AS converted_value
        FROM unpivoted u
        JOIN conversion c 
            ON u.year = c.year
            ${
                pricesSingle === "constant" | isGdpSingle
                ? `AND (
                    (u.exporter = c.country AND u.exporter IN (${countrySingleSQLList})) 
                    OR 
                    (u.importer = c.country AND u.importer IN (${countrySingleSQLList}))
                )`
                : ""
            }
        GROUP BY u.year, u.exporter, u.importer, u.category
    ),
    aggregated AS (
        SELECT 
            category,  -- Group by category
            '${flowSingle}' AS flow, 
            SUM(converted_value) AS total_value
        FROM converted
        WHERE ${flowSingle === "exports" ? "exporter" : "importer"} IN (${countrySingleSQLList}) 
        GROUP BY category
    )
    SELECT 
        '${escapeSQL(countrySingle)}' AS country,
        a.category, 
        a.flow, 
        ${
            isGdpSingle
            ? "CASE WHEN a.flow = 'imports' THEN -1 * (a.total_value / g.gdp * 100) ELSE (a.total_value / g.gdp * 100) END AS value"
            : "CASE WHEN a.flow = 'imports' THEN -1 * a.total_value ELSE a.total_value END AS value"
        }
    FROM aggregated a
    CROSS JOIN gdp g;
`;

const queryTopCategories = await db.query(queryTopCategoriesString);

const dataTopCategories = queryTopCategories.toArray()
    .map((row) => ({
        ...row
    }))
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
        Single Country
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
        ${countrySingleInput}
        ${flowSingleInput}
    </div>
    <div class="settings-group">
        ${unitSingleInput}
        ${categorySingleInput}
    </div>
    <div class="settings-group">
        ${isGdpSingle ? html` ` : pricesSingleInput}
        ${timeRangeSingleInput}
    </div>
</div>
<div class="grid grid-cols-2">
    <div class="card">
        ${generateTitleSingle(countrySingle, flowSingle, {})}
        <h3 class="plot-subtitle">
            ${
                categorySingle === "All" 
                ? "All products"
                : categorySingle
            };
            ${
                timeRangeSingle[0] === timeRangeSingle[1] 
                ? timeRangeSingle[0] 
                : `${timeRangeSingle[0]}-${timeRangeSingle[1]}`
            }
        </h3>
        ${
            resize(
                (width) => topPartnersTable(dataTopPartners, flowSingle, width)
            )
        }
        <div class="bottom-panel">
            <div class="text-section">
                ${generateNote(unitSingle, pricesSingle, countrySingle)}
            </div>
            <div class="logo-section">
                <a href="https://data.one.org/" target="_blank">
                    <img src="./ONE-logo-black.png" alt="A black circle with ONE written in white thick letters.">
                </a>
            </div>
        </div>
    </div>
    <div class="card">
        ${generateTitleSingle(countrySingle, flowSingle, {plot: false})}
        <h3 class="plot-subtitle">
            Product categories;
            ${
                timeRangeSingle[0] === timeRangeSingle[1] 
                ? timeRangeSingle[0] 
                : `${timeRangeSingle[0]}-${timeRangeSingle[1]}`
            }
        </h3>
        ${
            resize(
                (width) => topPartnersTable(dataTopCategories, flowSingle, width)
            )
        }
        <div class="bottom-panel">
            <div class="text-section">
                ${generateNote(unitSingle, pricesSingle, countrySingle)}
            </div>
            <div class="logo-section">
                <a href="https://data.one.org/" target="_blank">
                    <img src="./ONE-logo-black.png" alt="A black circle with ONE written in white thick letters.">
                </a>
            </div>
        </div>
    </div>
</div>