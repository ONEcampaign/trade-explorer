export function xDomain(timerange) {
    return Array.from(
        {length: timerange[1] - timerange[0] + 1},
        (_, i) => timerange[0] + i
    )
}