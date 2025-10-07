import sys
import json
import pandas as pd
from pydeflate import imf_gdp_deflate, set_pydeflate_path
from bblocks.places import resolve_places

from src.data.config import logger, PATHS, time_range, base_year

set_pydeflate_path(PATHS.PYDEFLATE)


# def get_iso_codes() -> pd.DataFrame:
#     data = (
#         pd.read_json(PATHS.COUNTRIES)
#         .T.reset_index()
#         .rename(columns={"index": "Country"})
#     )
#
#     data = add_iso_codes_column(data, "Country", id_type="regex")
#
#     return data.iso_code.unique().tolist()


def create_df():
    with open(PATHS.COUNTRIES) as f:
        data = json.load(f)

    country_list = list(data.keys())

    df = pd.DataFrame(
        index=pd.MultiIndex.from_product(
            [range(time_range[0], time_range[1] + 1), country_list],
            names=["year", "country"],
        )
    ).reset_index()

    df["iso_code"] = resolve_places(
        df["country"], to_type="iso3_code", not_found="ignore"
    )

    df["value"] = 1

    return df


def deflate_current_usd():
    df = create_df()

    codes = {"USA": "usd", "CAN": "cad", "FRA": "eur", "GBR": "gbp"}
    for country, code in codes.items():
        df = imf_gdp_deflate(
            data=df,
            base_year=base_year,
            source_currency="USA",
            target_currency=country,
            year_column="year",
            id_column="iso_code",
            value_column="value",
            target_value_column=f"{code}_constant",
        )

    return df.drop(columns=["value", "iso_code"]).dropna(thresh=4, axis="rows")


def get_conversion_table():
    constant_df = deflate_current_usd()

    constant_df.to_csv(sys.stdout, index=False)


if __name__ == "__main__":
    logger.info("Creating constant conversions table")
    get_conversion_table()
