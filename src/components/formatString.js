export function formatString(str, options = {capitalize: true, inSentence: false, fileMode: false}) {
    let result = str;

    if (str === "balance") {
        result = "trade balance";
    }

    if (options.capitalize && !options.fileMode) {
        result = result.charAt(0).toUpperCase() + result.slice(1);
    }

    if (options.inSentence) {
        if (str === "balance") {
            result += " with ";
        } else if (str === "exports") {
            result += " from ";
        } else if (str === "imports") {
            result += " to ";
        }
    }

    if (options.fileMode) {
        result = result.toLowerCase().replace(/\s+/g, "_");
    }

    return result;
}
