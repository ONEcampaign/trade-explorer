// https://observablehq.observablehq.cloud/pangea/party/xlsx-downloads
import * as XLSX from "npm:xlsx";

export function downloadXLSX(data, unit, filename) {

    const arrayData = data.toArray()
        .map((row) => row.toJSON())
        .filter((d) => d.category === "All products")

    const dataToDownload = Object.values(
        arrayData.reduce((acc, row) => {
            const key = `${row.country}-${row.partner}-${row.year}`;

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

            // Add exports or imports based on the flow
            if (row.flow === "exports") {
                acc[key].exports = row[unit];
            } else if (row.flow === "imports") {
                acc[key].imports = row[unit];
            }

            return acc;
        }, {})
    ).map(entry => ({
        ...entry,
        balance: entry.exports + entry.imports,
        unit: unit,
    }));

    const worksheet = XLSX.utils.json_to_sheet(dataToDownload);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet);
    XLSX.writeFile(workbook, `${filename}.xlsx`);
}