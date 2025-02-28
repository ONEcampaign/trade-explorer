import {toPng} from 'npm:html-to-image';
import {utils, writeFile} from "npm:xlsx";

export function downloadPNG(elementId, filename) {
    const element = document.getElementById(elementId);
    if (!element) {
        console.error(`Element with ID "${elementId}" not found.`);
        return;
    }

    toPng(element, { pixelRatio: 2, backgroundColor: "white" })
        .then((dataUrl) => {
            const link = document.createElement('a');
            link.href = dataUrl;
            link.download = `${filename}.png`;
            link.click();
        })
        .catch((error) => {
            console.error('Error capturing the element as an image:', error);
        });
}

// https://observablehq.observablehq.cloud/pangea/party/xlsx-downloads
export function downloadXLSX(data, filename) {

    const isGDP = data[0].unit === "share of gdp";

    const dataToDownload = data.map(entry => {
        let { imports, exports, balance, gdp } = entry;

        if (isGDP) {
            entry.imports = (imports / gdp) * 100;
            entry.exports = (exports / gdp) * 100;
            entry.balance = (balance / gdp) * 100;
        }

        delete entry.gdp;
        return entry;
    });


    const worksheet = utils.json_to_sheet(dataToDownload);
    const workbook = utils.book_new();
    utils.book_append_sheet(workbook, worksheet);
    writeFile(workbook, `${filename}.xlsx`);
}