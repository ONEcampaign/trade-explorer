import sys

import pandas as pd

from pydeflate import imf_gdp_deflate, imf_exchange, set_pydeflate_path

from src.data.config import (
    logger,
    PATHS,
    time_range,
    base_year
)

set_pydeflate_path(PATHS.PYDEFLATE)


def current_to_constant():

    df = pd.DataFrame(
        {
            "year": range(time_range[0], time_range[1] + 1),
            "iso_code": "USA",
            "usd_current": [1] * (time_range[1] - time_range[0] + 1),
        }
    )

    df_usd = imf_gdp_deflate(
        data=df,
        base_year=base_year,
        id_column="iso_code",
        source_currency="USD",
        target_currency="USD",
        year_column="year",
        value_column="usd_current",
        target_value_column="usd_constant",
    )

    return df_usd


def multi_currency(df):

    currencies = {"CAN": "cad", "FRA": "eur", "GBR": "gbp"}

    df_conversion = df
    for country, code in currencies.items():

        df_conversion["iso_code"] = "USA"

        df_conversion = imf_exchange(
            data=df_conversion,
            source_currency="USD",
            id_column="iso_code",
            target_currency=country,
            year_column="year",
            value_column="usd_current",
            target_value_column=f"{code}_current",
        )

        df_conversion["iso_code"] = country

        df_conversion = imf_gdp_deflate(
            base_year=base_year,
            data=df_conversion,
            source_currency=country,
            id_column="iso_code",
            target_currency=country,
            year_column="year",
            value_column=f"{code}_current",
            target_value_column=f"{code}_constant",
        )

    df_conversion = df_conversion.drop(columns=["iso_code"])

    return df_conversion


def get_conversion_table():

    df = current_to_constant()
    df_conversion = multi_currency(df)

    df_conversion.to_csv(sys.stdout, index=False)


if __name__ == "__main__":
    logger.info("Creating currency conversions table")
    get_conversion_table()
