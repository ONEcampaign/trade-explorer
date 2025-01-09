export function yDomain(data, timeRange, flowField, mode = "multi") {
    const filteredData = data.filter(
        (d) => d.year >= timeRange[0] && d.year <= timeRange[1]
    );

    let minValue, maxValue;

    if (mode === "single") {
        // Single case: min from imports, max from exports
        minValue = Math.min(...filteredData.map((d) => d.imports));
        maxValue = Math.max(...filteredData.map((d) => d.exports));
    } else {
        // Multi case: min and max from the same flow field
        minValue = Math.min(...filteredData.map((d) => d[flowField]));
        maxValue = Math.max(...filteredData.map((d) => d[flowField]));
    }

    const range = maxValue - minValue;

    return [minValue - range * 0.1, maxValue + range * 0.1]; // Extend domain by 10%
}