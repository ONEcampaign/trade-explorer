export function formatString(str, options = { inSentence: false }) {
    let result = str;

    // Handle specific string replacements
    if (str === "balance") {
        result = "trade balance";
    }

    // Capitalize first letter
    result = result.charAt(0).toUpperCase() + result.slice(1);

    // Add context for a full sentence if required
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
