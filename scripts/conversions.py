import pandas as pd

from pydeflate import imf_gdp_deflate, imf_exchange, set_pydeflate_path

from scripts.config import PATHS, time_range

set_pydeflate_path(PATHS.PYDEFLATE)

df = pd.DataFrame({
    'year': range(time_range[0], time_range[1] + 1),
    'iso_code': "USA",
    'usd_current': [1] * (time_range[1] - time_range[0] + 1)
})

df_usd = imf_gdp_deflate(
    data=df,
    base_year=2015,
    id_column="iso_code",
    source_currency="USD",
    target_currency="USD",
    year_column="year",
    value_column="usd_current",
    target_value_column="usd_constant"
)

currencies = {
    "CAN": "cad",
    "FRA": "eur",
    "GBR": "gbp"
}

df_conversion = df_usd
for country, code in currencies.items():

    df_conversion["iso_code"] = "USA"

    df_conversion = imf_exchange(
        data=df_conversion,
        source_currency="USD",
        id_column="iso_code",
        target_currency=country,
        year_column="year",
        value_column="usd_current",
        target_value_column=f"{code}_current"
    )

    df_conversion["iso_code"] = country

    df_conversion = imf_gdp_deflate(
        base_year=2015,
        data=df_conversion,
        source_currency=country,
        id_column="iso_code",
        target_currency=country,
        year_column="year",
        value_column=f"{code}_current",
        target_value_column=f"{code}_constant"
    )


df_conversion = df_conversion.drop(columns=["iso_code"])

save_path = PATHS.DATA / "currency_conversion.csv"
df_conversion.to_csv(save_path, index=False)

