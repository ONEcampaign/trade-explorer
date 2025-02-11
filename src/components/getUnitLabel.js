export function getUnitLabel(unit, {
                                    long = true,
                                    value = ""
                                })
{

    let prefix, suffix;

    if (unit === "gdp") {
        prefix = "";
        suffix = "% of GDP"
    } else {
        if (long) {
            suffix = "Million"
        } else (
            suffix = "M"
        )

        if (unit === "usd") {
            prefix = "US$"
        } else if (unit === "eur") {
            prefix = "€"
        } else if (unit === "cad") {
            prefix =  "CA$"
        } else if (unit === "gbp") {
            prefix = "£"
        }

    }

    if (value === "") {
        return `${prefix} ${suffix}`
    } else {
        return `${prefix} ${value} ${suffix}`
    }

}