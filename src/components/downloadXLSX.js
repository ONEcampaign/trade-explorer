// https://observablehq.observablehq.cloud/pangea/party/xlsx-downloads
import * as XLSX from "npm:xlsx";

export function downloadXLSX(data, filename) {

    const arrayData = data.toArray()
        .map((row) => row.toJSON())

    const isGDP = arrayData[0].unit === "share of gdp";

    const dataToDownload = arrayData.map(entry => {
        let { imports, exports, balance, gdp } = entry;

        if (isGDP) {
            entry.imports = (imports / gdp) * 100;
            entry.exports = (exports / gdp) * 100;
            entry.balance = (balance / gdp) * 100;
        }

        delete entry.gdp;
        return entry;
    });


    const worksheet = XLSX.utils.json_to_sheet(dataToDownload);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet);
    XLSX.writeFile(workbook, `${filename}.xlsx`);
}