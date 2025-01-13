// https://observablehq.observablehq.cloud/pangea/party/xlsx-downloads
import * as XLSX from "npm:xlsx";

export function downloadXLSX(data, country, partner, timeRange, aggregation, categories, unit, flow, mode, filename) {

    let filteredData = data.filter(
        (d) =>
            d.partner === partner &&
            d.year >= timeRange[0] &&
            d.year <= timeRange[1] &&
            d[unit] != null
    );

    if (aggregation === "All products") {
        filteredData = filteredData.filter((d) => d.category === "All products");
    } else {
        filteredData = filteredData.filter((d) => categories.includes(d.category));
    }

    const transformedData = Object.values(
        filteredData.reduce((acc, row) => {
            const key = `${row.country}-${row.partner}-${row.year}-${row.category}`;

            // Initialize entry if it doesn't exist
            if (!acc[key]) {
                acc[key] = {
                    country: row.country,
                    partner: row.partner,
                    year: row.year,
                    category: row.category,
                    exports: 0,
                    imports: 0
                };
            }

            // Store exports and imports values
            if (row.flow === "exports") {
                acc[key].exports = row[unit];
            } else if (row.flow === "imports") {
                acc[key].imports = row[unit];
            }

            return acc;
        }, {})
    )
        .map(entry => [
            { ...entry, flow: "exports", [unit]: entry.exports },
            { ...entry, flow: "imports", [unit]: entry.imports },
            { ...entry, flow: "balance", [unit]: entry.exports + entry.imports }
        ]).flat();

    let dataToDownload
    if (mode === "single") {
        dataToDownload = transformedData.filter((d) => d.country === country);
    } else if (mode === "multi") {
        dataToDownload = transformedData.filter(
            (d) =>
                country.includes(d.country) &&
                d.flow === flow
        );

    }

    const selectedColumns = ["country", "partner", "year", "category", "flow", unit]
    dataToDownload = dataToDownload.map((item) =>
        Object.fromEntries(selectedColumns.map((col) => [col, item[col]]))
    );

    const worksheet = XLSX.utils.json_to_sheet(dataToDownload);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet);
    XLSX.writeFile(workbook, `${filename}.xlsx`);
}