export function getLimits(data) {
    let minValue = Infinity;
    let maxValue = -Infinity;

    data.forEach((row) => {
        Object.keys(row).forEach((key) => {
            if (key !== "year" && key !== "category" && row[key] != null) {
                // Skip 'year' and null/undefined values
                minValue = Math.min(minValue, row[key]);
                maxValue = Math.max(maxValue, row[key]);
            }
        });
    });

    return {min: minValue, max: maxValue};
}