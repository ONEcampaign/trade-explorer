import pandas as pd
import json
import logging

import bblocks_data_importers as bbdata
import country_converter as coco
from pydeflate import imf_gdp_deflate, set_pydeflate_path

from data_preparation.utils.paths import PATHS


def load_mappings():
    """
    Load mappings for product codes to categories and country codes to names.
    """
    with open(PATHS.HARMONISED_SYSTEM, "r") as f:
        hs_dict = json.load(f)
    product_code_to_category = {
        code: category for category, codes in hs_dict.items() for code in codes
    }

    country_codes = pd.read_csv(PATHS.COUNTRY_CODES)
    country_code_to_name = dict(
        zip(country_codes["country_code"], country_codes["country_name"])
    )

    return product_code_to_category, country_code_to_name


def filter_and_aggregate_data(
    raw_df,
    product_code_to_category,
    country_code_to_name,
    african_countries,
    one_markets,
):
    """
    Filter and aggregate the raw trade data.
    """
    df = raw_df.rename(
        columns={
            "t": "year",
            "i": "exporter",
            "j": "importer",
            "k": "product",
            "v": "value",
        }
    )

    df["category"] = df["product"].str[:2].map(product_code_to_category)
    df["exporter"] = df["exporter"].map(country_code_to_name)
    df["importer"] = df["importer"].map(country_code_to_name)

    df = df[
        (df["importer"].isin(african_countries) & df["exporter"].isin(one_markets))
        | (df["importer"].isin(one_markets) & df["exporter"].isin(african_countries))
    ]

    return df.groupby(["year", "exporter", "importer", "category"], as_index=False).agg(
        {"value": "sum"}
    )


def process_trade_data(year0: int, year1: int):
    """
    Process and aggregate trade data between African countries and ONE market countries.
    """
    product_code_to_category, country_code_to_name = load_mappings()
    african_countries = pd.read_csv(PATHS.AFRICAN_COUNTRIES)["countries"].tolist()
    one_markets = ["USA", "Canada", "United Kingdom", "France", "Germany", "Belgium"]

    agg_data_path = PATHS.DATA / f"{year0}_{year1}_raw_cepii.csv"
    if agg_data_path.exists():
        logging.info(f"Loading aggregated BACI data from {agg_data_path}")
        return pd.read_csv(agg_data_path), african_countries

    logging.info("Aggregating BACI data")
    dataframes = [
        filter_and_aggregate_data(
            pd.read_csv(
                PATHS.BACI / f"BACI_HS02_Y{year}_V202401b.csv", dtype={"k": str}
            ),
            product_code_to_category,
            country_code_to_name,
            african_countries,
            one_markets,
        )
        for year in range(year0, year1 + 1)
    ]

    logging.info(f"Saving aggregated BACI data to {agg_data_path}")
    agg_df = pd.concat(dataframes, ignore_index=True)
    agg_df.to_csv(agg_data_path, index=False)
    return agg_df, african_countries


def get_weo_gdp():
    weo = bbdata.WEO()
    df = weo.get_data()

    df = df[df.indicator_code == "NGDPD"]
    df.loc[:, "value"] = df["value"] * 1000
    df = df[["year", "entity_name", "value"]]

    return df


def convert_units(df_long: pd.DataFrame):
    """
    Merges the processed trade data with WEO data and performs final calculations.
    """
    cc = coco.CountryConverter()

    df_long["country_code"] = cc.convert(df_long["country"], to="ISO3")

    weo_df = get_weo_gdp()
    weo_df["country_code"] = cc.convert(weo_df["entity_name"], to="ISO3")

    result = pd.merge(
        df_long,
        weo_df,
        on=["year", "country_code"],
        how="left",
        # validate="many_to_one",
    )

    set_pydeflate_path(PATHS.PYDEFLATE)

    result = imf_gdp_deflate(
        data=result,
        base_year=2015,
        id_column="country_code",
        value_column="current_usd",
        target_value_column="constant_usd_2015",
    )

    result = imf_gdp_deflate(
        data=result,
        base_year=2015,
        id_column="country_code",
        value_column="value",
        target_value_column="constant_gdp_2015",
    )

    result.drop(
        ["country_code", "entity_name", "value"],
        axis=1,
        inplace=True,
    )

    result["pct_gdp"] = (
            result["constant_usd_2015"] / result["constant_gdp_2015"] * 100
    )

    return result


def compute_totals(df_long: pd.DataFrame):
    """
    Compute trade totals at various levels (country, regional, Africa) and by categories,
    including imports and exports as a percentage of GDP (pct_gdp).

    Parameters:
        df_long (pd.DataFrame): Input DataFrame with trade data.

    Returns:
        pd.DataFrame: DataFrame with aggregated totals and original data.
    """
    # Map countries to regions
    with open(PATHS.AFRICAN_REGIONS, "r") as f:
        african_regions = json.load(f)

    region_mapping = {
        country: region
        for region, countries in african_regions.items()
        for country in countries
    }
    df_long["region"] = df_long["country"].map(region_mapping)

    # Compute country-level import/exports totals by year
    country_totals = df_long.groupby(
        ["year", "country", "partner", "flow"], as_index=False
    ).agg({"current_usd": "sum", "constant_usd_2015": "sum", "pct_gdp": "sum"})
    country_totals["category"] = "All products"

    # Compute regional and Africa-wide GDP totals by year
    unique_gdp = df_long[["year", "country", "region", "constant_gdp_2015"]].drop_duplicates()
    regional_gdp = unique_gdp.groupby(["year", "region"], as_index=False).agg(
        {"constant_gdp_2015": "sum"}
    )
    africa_gdp = unique_gdp.groupby(["year"], as_index=False).agg(
        {"constant_gdp_2015": "sum"}
    )

    # Compute regional import/export totals by category and year
    regional_category_totals = df_long.groupby(
        ["year", "region", "partner", "category", "flow"], as_index=False
    ).agg({"current_usd": "sum", "constant_usd_2015": "sum"})
    regional_category_totals = regional_category_totals.merge(
        regional_gdp, on=["year", "region"], how="left"
    )
    regional_category_totals["pct_gdp"] = (
            regional_category_totals["constant_usd_2015"] / regional_category_totals["constant_gdp_2015"] * 100
    )
    regional_category_totals["country"] = regional_category_totals["region"]
    regional_category_totals["region"] = None

    # Compute regional import/export totals by year
    regional_totals = df_long.groupby(
        ["year", "region", "partner", "flow"], as_index=False
    ).agg({"current_usd": "sum", "constant_usd_2015": "sum"})
    regional_totals = regional_totals.merge(
        regional_gdp, on=["year", "region"], how="left"
    )
    regional_totals["pct_gdp"] = (
            regional_totals["constant_usd_2015"] / regional_totals["constant_gdp_2015"] * 100
    )
    regional_totals["country"] = regional_totals["region"]
    regional_totals["region"] = None
    regional_totals["category"] = "All products"

# Compute Africa-level import/export totals by year and category
    africa_category_totals = df_long.groupby(
        ["year", "partner", "category", "flow"], as_index=False
    ).agg({"current_usd": "sum", "constant_usd_2015": "sum"})
    africa_category_totals = africa_category_totals.merge(
        africa_gdp, on="year", how="left"
    )
    africa_category_totals["pct_gdp"] = (
            africa_category_totals["constant_usd_2015"] / africa_category_totals["constant_gdp_2015"] * 100
    )
    africa_category_totals["country"] = "Africa (total)"

    # Compute Africa-level import/export totals by year
    africa_totals = df_long.groupby(
        ["year", "partner", "flow"], as_index=False
    ).agg({"current_usd": "sum", "constant_usd_2015": "sum"})
    africa_totals = africa_totals.merge(africa_gdp, on="year", how="left")
    africa_totals["pct_gdp"] = (
            africa_totals["constant_usd_2015"] / africa_totals["constant_gdp_2015"] * 100
    )
    africa_totals["country"] = "Africa (total)"
    africa_totals["category"] = "All products"

    # Combine all results
    result = pd.concat(
        [
            df_long,
            country_totals,
            regional_category_totals,
            regional_totals,
            africa_category_totals,
            africa_totals,
        ],
        ignore_index=True,
    )

    # Drop unnecessary columns
    result.drop(["region", "constant_gdp_2015"], axis=1, inplace=True, errors="ignore")

    return result


def save_data(
    df: pd.DataFrame,
    year0: int,
    year1: int
):
    """
    Saves the final processed data in the desired format (json, csv, parquet or none).
    """

    path_to_save = PATHS.DATA / f"africa_trade_{year0}_{year1}.csv"
    logging.info(f"Saving data to {path_to_save}")
    df.to_csv(path_to_save, index=False)


def process_africa_trade_data(
    year0: int, year1: int
):
    """
    Process trade data between African countries and ONE market countries.
    """
    agg_df, african_countries = process_trade_data(year0, year1)

    exp_df = agg_df[agg_df["exporter"].isin(african_countries)].rename(
        columns={"exporter": "country", "importer": "partner", "value": "exports"}
    )
    exp_df["exports"] /= 1000

    imp_df = agg_df[agg_df["importer"].isin(african_countries)].rename(
        columns={"importer": "country", "exporter": "partner", "value": "imports"}
    )
    imp_df["imports"] /= -1000

    africa_trade = pd.merge(
        exp_df,
        imp_df,
        on=["year", "country", "partner", "category"],
        how="outer",
        validate="one_to_one",
    )

    africa_trade_long = africa_trade.melt(
        id_vars=["year", "country", "partner", "category"],
        value_vars=["exports", "imports"],
        var_name="flow",
        value_name="current_usd",
    )

    africa_trade_long = africa_trade_long.dropna(subset=["current_usd"])

    africa_trade_constant = convert_units(africa_trade_long)

    final_df = compute_totals(africa_trade_constant)

    save_data(final_df, year0, year1)