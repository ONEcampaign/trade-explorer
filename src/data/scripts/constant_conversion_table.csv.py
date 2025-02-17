import sys

import pandas as pd
from bblocks import add_iso_codes_column
from pydeflate import imf_gdp_deflate, set_pydeflate_path

from src.data.config import logger, PATHS, time_range, base_year

set_pydeflate_path(PATHS.PYDEFLATE)

codes = {"USA": "usd", "CAN": "cad", "FRA": "eur", "GBR": "gbp"}


def get_iso_codes() -> pd.DataFrame:
    data = (
        pd.read_json(PATHS.COUNTRIES)
        .T.reset_index()
        .rename(columns={"index": "Country"})
    )

    data = add_iso_codes_column(data, "Country", id_type="regex")

    return data.iso_code.unique().tolist()


def deflate_current_usd():
    data = pd.DataFrame(
        index=pd.MultiIndex.from_product(
            [range(time_range[0], time_range[1] + 1), get_iso_codes()],
            names=["year", "iso_code"],
        )
    ).reset_index()

    # Add 'value' column
    data["value"] = 1

    # Deflate usd

    for country, code in codes.items():
        data = imf_gdp_deflate(
            data=data,
            base_year=base_year,
            source_currency="USA",
            target_currency=country,
            year_column="year",
            id_column="iso_code",
            value_column="value",
            target_value_column=f"{code}_constant",
        )

    return data.drop(columns=["value"]).dropna(thresh=4, axis="rows")


def get_conversion_table():
    constant_df = deflate_current_usd()

    constant_df.to_csv(sys.stdout, index=False)


if __name__ == "__main__":
    logger.info("Creating constant conversions table")
    get_conversion_table()