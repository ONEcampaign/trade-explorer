export function formatString(str, options = { capitalize: true, inSentence: false }) {
    let result = str;

    if (str === "balance") {
        result = "trade balance";
    }

    if (options.capitalize) {
        result = result.charAt(0).toUpperCase() + result.slice(1);
    }

    if (options.inSentence) {
        if (str === "balance") {
            result += " with ";
        } else if (str === "exports") {
            result += " to ";
        } else if (str === "imports") {
            result += " from ";
        }
    }

    return result;
}
