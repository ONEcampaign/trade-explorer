export function reshapeDataForTable(data, flow) {
    // Determine whether to group by 'year' or 'category'
    const groupByKey = data[0].hasOwnProperty("year") ? "year" : "category";

    // Extract unique group keys (years or categories) and countries
    const groupKeys = [...new Set(data.map((d) => d[groupByKey]))].sort();
    const countries = [...new Set(data.map((d) => d.country))].sort();

    // Create an array of objects where each object represents a row for a specific group key
    const reshapedData = groupKeys.map((key) => {
        const row = {[groupByKey]: key};
        countries.forEach((country) => {
            const record = data.find(
                (d) => d[groupByKey] === key && d.country === country
            );
            row[country] = record ? record[flow] : null; // Use null if no data is available
        });
        return row;
    });

    return reshapedData;
}