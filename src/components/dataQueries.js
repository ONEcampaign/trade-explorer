import {FileAttachment} from "observablehq:stdlib";
import {DuckDBClient} from "npm:@observablehq/duckdb";
import {productCategories, groupMappings} from "./inputValues.js";


const db = await DuckDBClient.of({
    trade: FileAttachment("../data/scripts/trade.parquet"),
    current_conversion_table: FileAttachment("../data/scripts/current_conversion_table.csv"),
    constant_conversion_table: FileAttachment("../data/scripts/constant_conversion_table.csv"),
    gdp_table: FileAttachment("../data/scripts/gdp_table.csv"),
});

function getCountryList(name) {
    if (Array.isArray(name)) {
        return name.flatMap(n => groupMappings[n] || [n]);
    }
    return groupMappings[name] || [name];
}

function escapeSQL(str) {
    return str.replace(/'/g, "''");
}

const unpivotColumns = productCategories.map(cat => `'${escapeSQL(cat)}'`).join(", ");

// Generate CASE statement for importer/exporter mappings
function caseStatement(name, partners) {
    return partners.map(group =>
        `CASE WHEN ${name} IN (${groupMappings[group].map(escapeSQL).map(c => `'${c}'`).join(", ")}) THEN '${escapeSQL(group)}' END`
    ).join(", ");
}


export function singleQueries(
    country,
    unit,
    prices,
    timeRange,
    category,
    flow
) {

    const countryList = getCountryList(country);

    const countrySQLList = countryList
        .map(c => `'${escapeSQL(c)}'`)
        .join(", ");

    const isGdp = unit === "gdp";

    const unitColumn = isGdp ? "usd_constant" : `${unit}_${prices}`;

    const conversionTable = isGdp ? "constant_conversion_table" : `${prices}_conversion_table`

    const partners = topPartnersQuery(
        country, 
        countrySQLList,
        isGdp,
        unit,
        unitColumn,
        prices, 
        conversionTable, 
        timeRange, 
        category, 
        flow
    )

    const categories = topCategoriesQuery(
        country, 
        countrySQLList,
        isGdp,
        unit,
        unitColumn, 
        prices, 
        conversionTable, 
        timeRange, 
        flow
    );

    const worldTrade = worldTradeQuery(
        country,
        countrySQLList,
        isGdp,
        unit,
        unitColumn,
        prices,
        conversionTable,
        timeRange,
        category
    )


    return {partners, categories, worldTrade};
}


async function topPartnersQuery(
    country,
    countrySQLList,
    isGdp,
    unit,
    unitColumn,
    prices,
    conversionTable,
    timeRange,
    category,
    flow
) {

    const string = `
        WITH filtered AS (
            SELECT * 
            FROM trade
            WHERE 
                (${flow === "exports" ? "exporter" : "importer"} IN (${countrySQLList}) 
                AND ${flow === "exports" ? "importer" : "exporter"} NOT IN (${countrySQLList}))
                AND year BETWEEN ${timeRange[0]} AND ${timeRange[1]}
        ),
        unpivoted AS (
            SELECT year, exporter, importer, category, value
            FROM filtered
            UNPIVOT (value FOR category IN (${category === "All" ? unpivotColumns : `'${category}'`}))
        ),
        conversion AS (
            SELECT 
                year, 
                ${prices === "constant" | isGdp ? "country AS country," : ""}
                ${unitColumn} AS factor
            FROM ${conversionTable}
            ${prices === "constant" | isGdp ? `WHERE country IN (${countrySQLList})` : ""}
        ),
        gdp AS (
            SELECT SUM(gdp_constant) AS gdp
            FROM gdp_table
            WHERE country IN (${countrySQLList})
                AND year BETWEEN ${timeRange[0]} AND ${timeRange[1]}
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
                        prices === "constant" | isGdp
                        ?`AND (
                            (u.exporter = c.country AND u.exporter IN (${countrySQLList})) 
                            OR 
                            (u.importer = c.country AND u.importer IN (${countrySQLList}))
                        )`
                        : ""               
                    }
            GROUP BY u.year, u.exporter, u.importer
        ),
        aggregated AS (
            SELECT 
                ${flow === "exports" ? "importer" : "exporter"} AS partner, 
                '${flow}' AS flow, 
                SUM(converted_value) AS total_value
            FROM converted
            WHERE ${flow === "exports" ? "exporter" : "importer"} IN (${countrySQLList}) 
            GROUP BY ${flow === "exports" ? "importer" : "exporter"}
        )
        SELECT
            '${timeRange[0]}-${timeRange[1]}' AS years,
            '${escapeSQL(country)}' AS country,
            a.partner,
            -- '${escapeSQL(category)}' AS category,
            a.flow, 
            ${
                isGdp
                ? "CASE WHEN a.flow = 'imports' THEN -1 * (a.total_value / g.gdp * 100) ELSE (a.total_value / g.gdp * 100) END AS value,"
                : "CASE WHEN a.flow = 'imports' THEN -1 * a.total_value ELSE a.total_value END AS value,"
            }
            CASE
                WHEN ${isGdp} THEN 'share of gdp'
                ELSE '${prices} ${unit} million'
            END AS unit 
        FROM aggregated a
        CROSS JOIN gdp g
        `;

    const query =  await db.query(string);

    return query.toArray().map((row) => ({
        ...row
    }));

}

async function topCategoriesQuery(
    country,
    countrySQLList,
    isGdp,
    unit,
    unitColumn,
    prices,
    conversionTable,
    timeRange,
    flow
) {

    const string = `
        WITH filtered AS (
            SELECT * 
            FROM trade
            WHERE 
                (${flow === "exports" ? "exporter" : "importer"} IN (${countrySQLList}) 
                AND ${flow === "exports" ? "importer" : "exporter"} NOT IN (${countrySQLList}))
                AND year BETWEEN ${timeRange[0]} AND ${timeRange[1]}
        ),
        unpivoted AS (
            SELECT year, exporter, importer, category, value
            FROM filtered
            UNPIVOT (value FOR category IN (${unpivotColumns}))
        ),
        conversion AS (
            SELECT 
                year, 
                ${prices === "constant" | isGdp ? "country AS country," : ""}
                ${unitColumn} AS factor
            FROM ${conversionTable}
            ${prices === "constant" | isGdp ? `WHERE country IN (${countrySQLList})` : ""}
        ),
        gdp AS (
            SELECT SUM(gdp_constant) AS gdp
            FROM gdp_table
            WHERE country IN (${countrySQLList})
            AND year BETWEEN ${timeRange[0]} AND ${timeRange[1]}
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
                        prices === "constant" | isGdp
                        ? `AND (
                                (u.exporter = c.country AND u.exporter IN (${countrySQLList})) 
                                OR 
                                (u.importer = c.country AND u.importer IN (${countrySQLList}))
                            )`
                        : ""
                    }
            GROUP BY u.year, u.exporter, u.importer, u.category
        ),
        aggregated AS (
            SELECT 
                category,
                '${flow}' AS flow, 
                SUM(converted_value) AS total_value
            FROM converted
            WHERE ${flow === "exports" ? "exporter" : "importer"} IN (${countrySQLList}) 
            GROUP BY category
        )
        SELECT
            '${timeRange[0]}-${timeRange[1]}' AS years,
            '${escapeSQL(country)}' AS country,
            'RoW' AS partner,
            a.category, 
            a.flow, 
            ${
                isGdp
                ? "CASE WHEN a.flow = 'imports' THEN -1 * (a.total_value / g.gdp * 100) ELSE (a.total_value / g.gdp * 100) END AS value,"
                : "CASE WHEN a.flow = 'imports' THEN -1 * a.total_value ELSE a.total_value END AS value,"
            }
            CASE
                WHEN ${isGdp} THEN 'share of gdp'
                ELSE '${prices} ${unit} million'
            END AS unit
        FROM aggregated a
        CROSS JOIN gdp g
        `;

    const query =  await db.query(string);

    return query.toArray().map((row) => ({
        ...row
    }));

}

async function worldTradeQuery(
    country,
    countrySQLList,
    isGdp,
    unit,
    unitColumn,
    prices,
    conversionTable,
    timeRange,
    category
) {

    const string = `
        WITH years_raw AS (
            SELECT * FROM GENERATE_SERIES(${timeRange[0]}, ${timeRange[1]})
        ),
        years AS (
            SELECT generate_series AS year 
            FROM years_raw
        ),
        filtered AS (
            SELECT *
            FROM trade
            WHERE
                (importer IN (${countrySQLList}) OR exporter IN (${countrySQLList}))
                    AND year BETWEEN ${timeRange[0]} AND ${timeRange[1]}
        ),
        unpivoted AS (
            SELECT year, exporter, importer, category, value
            FROM filtered
                UNPIVOT (value FOR category IN (${category === "All" ? unpivotColumns : `'${category}'`}))
        ),
        conversion AS (
            SELECT
                year,
                ${prices === "constant" | isGdp ? "country AS country," : ""}
                        ${unitColumn} AS factor
            FROM ${conversionTable}
                ${prices === "constant" | isGdp ? `WHERE country IN (${countrySQLList})` : ""}
        ),
        gdp AS (
            SELECT year, SUM(gdp_constant) AS gdp
            FROM gdp_table
            WHERE country IN (${countrySQLList})
            GROUP BY year
        ),
        exports AS (
            SELECT u.year, u.exporter AS country, SUM(u.value * c.factor * 1.1 / 1.1) AS exports
            FROM unpivoted u
            JOIN conversion c
                ON u.year = c.year
                ${
                    prices === "constant" | isGdp 
                    ? `AND u.exporter = c.country`
                    : ""
                }
            WHERE u.exporter IN (${countrySQLList})
            GROUP BY u.year, u.exporter
        ),
        imports AS (
            SELECT u.year, u.importer AS country, SUM(u.value * c.factor * 1.1 / 1.1) AS imports
            FROM unpivoted u
            JOIN conversion c
                ON u.year = c.year
                ${
                    prices === "constant" | isGdp
                    ? `AND u.importer = c.country` 
                    : ""
                }
            WHERE u.importer IN (${countrySQLList})
            GROUP BY u.year, u.importer
        )
        SELECT
            y.year,
            '${escapeSQL(country)}' AS country,
            'RoW' AS partner,
            '${escapeSQL(category)}' AS category,
            ${
                isGdp
                ? `
                    NULLIF(SUM(COALESCE(i.imports * -1 / g.gdp * 100, 0)), 0) AS imports,
                    NULLIF(SUM(COALESCE(e.exports / g.gdp * 100, 0)), 0) AS exports,
                    CASE
                        WHEN NULLIF(SUM(COALESCE(i.imports * -1 / g.gdp * 100, 0)), 0) IS NULL
                            AND NULLIF(SUM(COALESCE(e.exports / g.gdp * 100, 0)), 0) IS NULL
                        THEN NULL
                        ELSE (SUM(COALESCE(e.exports / g.gdp * 100, 0)) - SUM(COALESCE(i.imports / g.gdp * 100, 0)))
                    END AS balance
                `
                : `
                    NULLIF(SUM(COALESCE(i.imports * -1, 0)), 0) AS imports,
                    NULLIF(SUM(COALESCE(e.exports, 0)), 0) AS exports,
                    CASE
                        WHEN NULLIF(SUM(COALESCE(i.imports * -1, 0)), 0) IS NULL
                            AND NULLIF(SUM(COALESCE(e.exports, 0)), 0) IS NULL
                        THEN NULL
                        ELSE (SUM(COALESCE(e.exports, 0)) - SUM(COALESCE(i.imports, 0)))
                    END AS balance
                `
            },
            CASE
                WHEN ${isGdp} THEN 'share of gdp'
                ELSE '${prices} ${unit} million'
            END AS unit
        FROM years y
            LEFT JOIN exports e ON y.year = e.year
            FULL OUTER JOIN imports i ON y.year = i.year AND e.country = i.country
            LEFT JOIN gdp g ON y.year = g.year
        GROUP BY y.year
        ORDER BY y.year
    `;

    const query =  await db.query(string);

    return query.toArray().map((row) => ({
        ...row
    }));

}

export function multiQueries(country, partners, unit, prices, timeRange, category, flow) {

    const countryList = getCountryList(country);
    const partnersList = getCountryList(partners);

    const countrySQLList = countryList.map(escapeSQL).map(c => `'${c}'`).join(", ");
    const partnersSQLList = partnersList.length > 0
        ? partnersList.map(escapeSQL).map(c => `'${c}'`).join(", ")
        : "'NO_MATCH'"; // Fallback value that will never match

    const isGdp = unit === "gdp"
    const unitColumn = isGdp
        ? "usd_constant"
        : `${unit}_${prices}`;
    const conversionTable = isGdp
        ? "constant_conversion_table"
        : `${prices}_conversion_table`

    // Define flow column selection
    const flowColumn = flow === 'exports'
        ? `COALESCE(SUM(e.exports), 0)`
        : flow === 'imports'
            ? `COALESCE(SUM(i.imports), 0) * -1`
            : `COALESCE(SUM(e.exports), 0) - COALESCE(SUM(i.imports), 0)`

    const plot = plotQuery(
        countrySQLList,
        country,
        partnersSQLList,
        partners,
        isGdp,
        unit,
        unitColumn,
        prices,
        conversionTable,
        timeRange,
        category
    )

    const table = tableQuery(
        countrySQLList,
        country,
        partnersSQLList,
        partners,
        isGdp,
        unit,
        unitColumn,
        prices,
        conversionTable,
        timeRange
    )

    return {plot, table}

}


async function plotQuery(
    countrySQLList,
    country,
    partnersSQLList,
    partners,
    isGdp,
    unit,
    unitColumn,
    prices,
    conversionTable,
    timeRange,
    category
) {

    const string = `
        WITH years AS (
            SELECT * FROM GENERATE_SERIES(${timeRange[0]}, ${timeRange[1]})
        ),
        partners AS (
            SELECT unnest(ARRAY[${partnersSQLList}]) AS partner
        ),
        years_partners AS (
            SELECT y.generate_series AS year, p.partner
            FROM years y
            CROSS JOIN partners p
        ),
        filtered AS (
            SELECT * 
            FROM trade
            WHERE 
                ((exporter IN (${countrySQLList}) AND importer IN (${partnersSQLList})) OR 
                (importer IN (${countrySQLList}) AND exporter IN (${partnersSQLList}))) 
                AND year BETWEEN ${timeRange[0]} AND ${timeRange[1]}
        ),
        unpivoted AS (
            SELECT year, exporter, importer, category, value
            FROM filtered
            UNPIVOT (value FOR category IN (${category === "All" ? unpivotColumns : `'${category}'`}))
        ),
        conversion AS (
            SELECT year, ${prices === "constant" | isGdp ? "country," : ""} ${unitColumn} AS factor 
            FROM ${conversionTable}
            ${prices === "constant" | isGdp ? `WHERE country IN (${countrySQLList})` : ""}
        ),
        gdp AS (
            SELECT year, SUM(gdp_constant) AS gdp
            FROM gdp_table
            WHERE country IN (${countrySQLList})
            GROUP BY year
        ),
        exports AS (
            SELECT year, partner, SUM(exports) AS exports
            FROM (
                SELECT 
                    u.year, 
                    SUM(u.value * c.factor * 1.1 / 1.1) AS exports,
                    unnest(ARRAY[ ${caseStatement("u.importer", partners)} ]) AS partner
            FROM unpivoted u
                JOIN conversion c 
                    ON u.year = c.year
                    ${prices === "constant" | isGdp ? "AND u.exporter = c.country" : ""} 
                WHERE u.exporter IN (${countrySQLList}) 
                AND u.importer IN (${partnersSQLList})
                GROUP BY u.year, u.importer
            ) expanded
            WHERE partner IS NOT NULL
            GROUP BY year, partner
        ),
        imports AS (
            SELECT year, partner, SUM(imports) AS imports
            FROM (
                SELECT 
                    u.year, 
                    SUM(u.value * c.factor * 1.1 / 1.1) AS imports,
                    unnest(ARRAY[ ${caseStatement("u.exporter", partners)} ]) AS partner
                FROM unpivoted u
                JOIN conversion c 
                    ON u.year = c.year
                    ${prices === "constant" | isGdp ? "AND u.importer = c.country" : ""} 
                WHERE u.importer IN (${countrySQLList}) 
                AND u.exporter IN (${partnersSQLList})
                GROUP BY u.year, u.exporter
            ) expanded
            WHERE partner IS NOT NULL
            GROUP BY year, partner
        )
        SELECT
            yp.year,
            '${escapeSQL(country)}' AS country,
            yp.partner,
            '${escapeSQL(category)}' AS category,
            ${
                isGdp
                ?
                `
                    NULLIF(SUM(COALESCE(i.imports * -1 / g.gdp * 100, 0)), 0) AS imports,
                    NULLIF(SUM(COALESCE(e.exports / g.gdp * 100, 0)), 0) AS exports,
                    CASE 
                        WHEN NULLIF(SUM(COALESCE(i.imports * -1 / g.gdp * 100, 0)), 0) IS NULL
                            AND NULLIF(SUM(COALESCE(e.exports / g.gdp * 100, 0)), 0) IS NULL
                        THEN NULL
                        ELSE (SUM(COALESCE(e.exports / g.gdp * 100, 0)) - SUM(COALESCE(i.imports / g.gdp * 100, 0)))
                    END AS balance
                `
                :
                `
                    NULLIF(SUM(COALESCE(i.imports * -1, 0)), 0) AS imports,
                    NULLIF(SUM(COALESCE(e.exports, 0)), 0) AS exports,
                    CASE 
                        WHEN NULLIF(SUM(COALESCE(i.imports * -1, 0)), 0) IS NULL
                            AND NULLIF(SUM(COALESCE(e.exports, 0)), 0) IS NULL
                        THEN NULL
                        ELSE (SUM(COALESCE(e.exports, 0)) - SUM(COALESCE(i.imports, 0)))
                    END AS balance
                `
            },
            CASE WHEN ${isGdp} THEN 'share of gdp'
                 ELSE '${prices} ${unit} million'
            END AS unit
        FROM years_partners yp
            LEFT JOIN exports e ON yp.year = e.year AND yp.partner = e.partner
            LEFT JOIN imports i ON yp.year = i.year AND yp.partner = i.partner
            LEFT JOIN gdp g ON yp.year = g.year
        GROUP BY yp.year, yp.partner
        ORDER BY yp.partner, yp.year;
    `;

    const query = await db.query(string);

    return query.toArray()
        .map((row) => ({
            ...row
        }))

}


async function tableQuery(
    countrySQLList,
    country,
    partnersSQLList,
    partners,
    isGdp,
    unit,
    unitColumn,
    prices,
    conversionTable,
    timeRange
) {

    const string = `
        WITH filtered AS (
            SELECT * 
            FROM trade
            WHERE 
                ((exporter IN (${countrySQLList}) AND importer IN (${partnersSQLList})) OR 
                (importer IN (${countrySQLList}) AND exporter IN (${partnersSQLList}))) 
                AND year BETWEEN ${timeRange[0]} AND ${timeRange[1]}
        ),
        unpivoted AS (
            SELECT year, exporter, importer, category, value
            FROM filtered
            UNPIVOT (value FOR category IN (${unpivotColumns}))
        ),
        conversion AS (
            SELECT year, ${prices === "constant" | isGdp ? "country," : ""} ${unitColumn} AS factor 
            FROM ${conversionTable}
            ${prices === "constant" | isGdp ? `WHERE country IN (${countrySQLList})` : ""}
        ),
        gdp AS (
            SELECT year, SUM(gdp_constant) AS gdp
            FROM gdp_table
            WHERE country IN (${countrySQLList})
            GROUP BY year
        ),
        exports AS (
            SELECT year, partner, category, SUM(exports) AS exports
            FROM (
                SELECT u.year, u.category, SUM(u.value * c.factor * 1.1 / 1.1) AS exports, 
                       unnest(ARRAY[ ${caseStatement("u.importer", partners)} ]) AS partner
                FROM unpivoted u
                JOIN conversion c 
                    ON u.year = c.year
                    ${prices === "constant" | isGdp ? "AND u.exporter = c.country" : ""} 
                WHERE u.exporter IN (${countrySQLList}) 
                    AND u.importer IN (${partnersSQLList})
                GROUP BY u.year, u.importer, u.category
            ) expanded
            WHERE partner IS NOT NULL
            GROUP BY year, partner, category
        ),
        imports AS (
            SELECT year, partner, category, SUM(imports) AS imports
            FROM (
                SELECT u.year, u.category, SUM(u.value * c.factor * 1.1 / 1.1) AS imports,
                       unnest(ARRAY[ ${caseStatement("u.exporter", partners)} ]) AS partner
                FROM unpivoted u
                JOIN conversion c 
                    ON u.year = c.year
                    ${prices === "constant" | isGdp ? "AND u.importer = c.country" : ""} 
                WHERE u.importer IN (${countrySQLList}) 
                    AND u.exporter IN (${partnersSQLList})
                GROUP BY u.year, u.exporter, u.category
            ) expanded
            WHERE partner IS NOT NULL
            GROUP BY year, partner, category
        ),
        trade_gdp_ratio AS (
            SELECT
                COALESCE(e.year, i.year) AS year,
                COALESCE(e.partner, i.partner) AS partner,
                COALESCE(e.category, i.category) AS category,
                ${
                    isGdp 
                    ? `
                        COALESCE(i.imports * -1 / g.gdp * 100, 0) AS imports,
                        COALESCE(e.exports / g.gdp * 100, 0) AS exports,
                        (COALESCE(e.exports / g.gdp * 100, 0) - COALESCE(i.imports / g.gdp * 100, 0)) AS balance
                    `
                    : `
                        COALESCE(i.imports * -1, 0) AS imports,
                        COALESCE(e.exports, 0) AS exports,
                        (COALESCE(e.exports, 0) - COALESCE(i.imports, 0)) AS balance
                    `
                },
            FROM exports e
                FULL OUTER JOIN imports i
            ON e.category = i.category AND e.year = i.year AND e.partner = i.partner
                JOIN gdp g
                ON e.year = g.year OR i.year = g.year
        )
        SELECT
            '${timeRange[0]}-${timeRange[1]}' AS years,
            '${escapeSQL(country)}' AS country,
            partner, 
            category, 
            AVG(imports) AS imports,
            AVG(exports) AS exports,
            AVG(balance) AS balance,
            CASE
                WHEN ${isGdp} THEN 'share of gdp'
                ELSE '${prices} ${unit} million'
             END AS unit
        FROM trade_gdp_ratio
        GROUP BY partner, category;

    `;

    const query = await db.query(string);

    return query.toArray()
        .map((row) => ({
            ...row
        }))

}









