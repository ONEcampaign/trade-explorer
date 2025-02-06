export function getCurrencyLabel(currency, {
                                    long = true,
                                    value = ""
                                })
{
    let unit;
    if (long) {
        unit = "Million"
    } else (
        unit = "M"
    )
    let symbol;
    if (currency === "usd") {
        symbol = "US$"
    } else if (currency === "eur") {
        symbol = "€"
    } else if (currency === "cad") {
        symbol =  "CA$"
    } else if (currency === "gbp") {
        symbol = "£"
    }
    if (value === "") {
        return `${symbol} ${unit}`
    } else {
        return `${symbol} ${value} ${unit}`
    }

}