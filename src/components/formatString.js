export function formatString(str, options = { capitalize: true, inSentence: false, fileMode: false }) {
    let result = str.includes("balance") ? str.replace("balance", "trade balance") : str;

    if (options.inSentence) {
        result = result.replace(/\bbalance\b/, "balance with")
            .replace(/\bexports\b/, "exports from")
            .replace(/\bimports\b/, "imports to");
    }

    if (options.capitalize && !options.fileMode) {
        result = result.charAt(0).toUpperCase() + result.slice(1);
    }


    // Convert to file format if fileMode is enabled
    if (options.fileMode) {
        result = result.toLowerCase().replace(/\s+/g, "_");
    }

    return result;
}
