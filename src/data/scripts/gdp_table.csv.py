import sys

import pandas as pd
import json
import itertools

import country_converter as coco
import bblocks_data_importers as bbdata
from pydeflate import imf_gdp_deflate, set_pydeflate_path

from src.data.config import logger, PATHS, time_range, base_year

set_pydeflate_path(PATHS.PYDEFLATE)


def load_countries():
    with open(PATHS.COUNTRIES, "r") as f:
        country_to_groups = json.load(f)
        countries = list(country_to_groups.keys())
        return countries


def generate_country_year_df(countries, time_range):

    years = list(range(time_range[0], time_range[1] + 1))
    combinations = itertools.product(years, countries)
    df = pd.DataFrame(combinations, columns=["year", "country"])

    return df


def load_format_weo():
    weo = bbdata.WEO()
    df_raw = weo.get_data()

    df = df_raw.query("indicator_code == 'NGDPD' & unit == 'U.S. dollars'")[
        ["year", "entity_name", "value"]
    ]

    df.rename(columns={"value": "gdp_current"}, inplace=True)

    df["gdp_current"] *= 1_000  # Convert from billions to millions

    return df


def merge_dfs(country_df, gdp_df):

    cc = coco.CountryConverter()

    country_df["iso"] = cc.pandas_convert(country_df["country"], to="ISO3")

    gdp_df["iso"] = cc.pandas_convert(gdp_df["entity_name"], to="ISO3")
    gdp_df = gdp_df.drop("entity_name", axis=1)

    full_df = country_df.merge(gdp_df, on=["iso", "year"], how="left")

    full_df.drop(columns="iso", inplace=True)

    return full_df


def current_to_constant(df):

    df["iso_code"] = "USA"

    df_constant = imf_gdp_deflate(
        data=df,
        base_year=base_year,
        id_column="iso_code",
        source_currency="USD",
        target_currency="USD",
        year_column="year",
        value_column="gdp_current",
        target_value_column="gdp_constant",
    )

    df_constant.drop(columns=["iso_code", "gdp_current"], inplace=True)

    return df_constant


def get_gdp_table():

    countries = load_countries()
    country_df = generate_country_year_df(countries, time_range)
    gdp_df = load_format_weo()
    merged_df = merge_dfs(country_df, gdp_df)
    gdp_table = current_to_constant(merged_df)

    gdp_table.to_csv(sys.stdout, index=False)


if __name__ == "__main__":
    logger.info("Creating GDP table")
    get_gdp_table()
