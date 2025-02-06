export function jitterLabels(
    data,
    unit,
    xKey = "Year",
    groupKey = "Country",
    thresholdPercent = 0.05,
    maxIterations = 10,
    jitterAmount = 0.2
) {
    // Group data by "country" and find the right-most non-null point for each series
    const seriesMap = new Map();
    data.forEach((d) => {
        if (d[unit] != null) {
            const country = d[groupKey];
            if (!seriesMap.has(country) || d[xKey] > seriesMap.get(country)[xKey]) {
                seriesMap.set(country, d);
            }
        }
    });

    // Extract right-most points for jittering
    const rightMostPoints = Array.from(seriesMap.values());

    // Compute the y domain (min and max values of unit)
    const yValues = rightMostPoints.map((d) => d[unit]);
    const yMin = Math.min(...yValues);
    const yMax = Math.max(...yValues);
    const threshold = (yMax - yMin) * thresholdPercent; // Threshold distance for detecting overlaps

    // Sort data by xKey and unit (yKey)
    const sortedData = [...rightMostPoints].sort(
        (a, b) => a[xKey] - b[xKey] || a[unit] - b[unit]
    );

    // Initialize offsets for labels
    const labelOffsets = Array(sortedData.length).fill(0);

    // Apply jitter iteratively to resolve overlaps
    let iterations = 0;
    let overlapping = true;

    while (overlapping && iterations < maxIterations) {
        overlapping = false;
        iterations++;

        for (let i = 1; i < sortedData.length; i++) {
            const current = sortedData[i];
            const previous = sortedData[i - 1];

            if (
                current[xKey] === previous[xKey] &&
                Math.abs(current[unit] + labelOffsets[i] - (previous[unit] + labelOffsets[i - 1])) < threshold
            ) {
                // Detected overlap: apply jitter to separate them
                overlapping = true;
                const jitter = (Math.random() - 0.5) * 2 * jitterAmount; // Random jitter within ±jitterAmount
                labelOffsets[i] += jitter;
            }
        }
    }

    // Return original data along with computed label offsets for right-most points
    return sortedData.map((d, i) => ({
        ...d,
        labelOffset: labelOffsets[i]
    }));
}
