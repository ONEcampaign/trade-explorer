export function filterData(data, countries, partner, timeRange, unit, mode) {
    // Start by applying the initial filter
    let dataFiltered = data.filter(
        (d) =>
            d.partner === partner &&
            d.year >= timeRange[0] && // Assuming timeRange[0] is the start year
            d.year <= timeRange[1] && // Assuming timeRange[1] is the end year
            d[unit] != null
    );

    // Filter by mode (single or multi-country)
    if (mode === "single") {
        dataFiltered = dataFiltered.filter((d) => d.country === countries);
    } else if (mode === "multi") {
        dataFiltered = dataFiltered.filter((d) => countries.includes(d.country));
    }

    return dataFiltered;
}