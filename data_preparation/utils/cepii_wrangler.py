import pandas as pd
import json
import pyarrow as pa
import pyarrow.parquet as pq

from typing import Optional, Literal

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
        return pd.read_csv(agg_data_path), african_countries

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

    full_df = pd.merge(
        df_long,
        weo_df,
        on=["year", "country_code"],
        how="left",
        # validate="many_to_one",
    )

    set_pydeflate_path(PATHS.PYDEFLATE)

    full_df = imf_gdp_deflate(
        data=full_df,
        base_year=2015,
        id_column="country_code",
        value_column="current_usd",
        target_value_column="constant_usd_2015",
    )

    full_df = imf_gdp_deflate(
        data=full_df,
        base_year=2015,
        id_column="country_code",
        value_column="value",
        target_value_column="constant_gdp_2015",
    )

    full_df["pct_gdp"] = (
        full_df["constant_usd_2015"] / full_df["constant_gdp_2015"] * 100
    )
    full_df.drop(
        ["country_code", "entity_name", "value", "constant_gdp_2015"],
        axis=1,
        inplace=True,
    )
    full_df = full_df.dropna(subset=["current_usd"])

    return full_df


def compute_totals(df_long: pd.DataFrame):

    # Map countries to regions
    with open(PATHS.AFRICAN_REGIONS, "r") as f:
        african_regions = json.load(f)

    region_mapping = {
        country: region
        for region, countries in african_regions.items()
        for country in countries
    }
    df_long["region"] = df_long["country"].map(region_mapping)

    # compute regional total imports/exports by product category
    regional_totals = df_long.groupby(
        ["year", "region", "partner", "category", "flow"], as_index=False
    ).agg({"current_usd": "sum", "constant_usd_2015": "sum"})
    regional_totals["pct_gdp"] = None
    regional_totals["country"] = regional_totals["region"]
    regional_totals["region"] = None

    # compute regional total imports/exports
    regional_totals_all = df_long.groupby(
        ["year", "region", "partner", "flow"], as_index=False
    ).agg({"current_usd": "sum", "constant_usd_2015": "sum"})
    regional_totals_all["pct_gdp"] = None
    regional_totals_all["country"] = regional_totals_all["region"]
    regional_totals_all["region"] = None
    regional_totals_all["category"] = "Total"

    # compute total imports/exports by product category
    africa_totals = df_long.groupby(
        ["year", "partner", "category", "flow"], as_index=False
    ).agg({"current_usd": "sum", "constant_usd_2015": "sum"})
    africa_totals["pct_gdp"] = None
    africa_totals["country"] = "Africa (total)"

    # compute total imports/exports
    africa_totals_all = df_long.groupby(
        ["year", "partner", "flow"], as_index=False
    ).agg({"current_usd": "sum", "constant_usd_2015": "sum"})
    africa_totals_all["pct_gdp"] = None
    africa_totals_all["country"] = "Africa (total)"
    africa_totals_all["category"] = "Total"

    # compute country total imports/exports by product
    country_totals = df_long.groupby(
        ["year", "country", "partner", "category", "flow"], as_index=False
    ).agg({"current_usd": "sum", "constant_usd_2015": "sum", "pct_gdp": "sum"})

    # compute country total imports/exports
    country_totals_all = df_long.groupby(
        ["year", "country", "partner", "flow"], as_index=False
    ).agg({"current_usd": "sum", "constant_usd_2015": "sum", "pct_gdp": "sum"})
    country_totals_all["category"] = "Total"

    # combine all results
    result = pd.concat(
        [
            df_long,
            regional_totals,
            regional_totals_all,
            africa_totals,
            africa_totals_all,
            country_totals,
            country_totals_all,
        ],
        ignore_index=True,
    )

    result.drop(
        ["region"],
        axis=1,
        inplace=True,
    )

    return result


def save_data(
    df: pd.DataFrame,
    year0: int,
    year1: int,
    save_as: Optional[Literal["json", "csv", "parquet"]] = None,
):
    """
    Saves the final processed data in the desired format (json, csv, parquet or none).
    """
    path_to_save = PATHS.SAVED_DATA / f"africa_trade_{year0}_{year1}.{save_as}"

    if save_as == "json":
        path_to_save.write_text(df.to_json(orient="records"))
    elif save_as == "csv":
        df.to_csv(path_to_save, index=False)
    elif save_as == "parquet":
        arrow_table = pa.Table.from_pandas(df)
        pq.write_table(arrow_table, path_to_save, compression="BROTLI")
    else:
        return df


def process_africa_trade_data(
    year0: int, year1: int, save_as: Optional[Literal["json", "csv", "parquet"]] = None
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

    africa_trade_constant = convert_units(africa_trade_long)

    full_df = compute_totals(africa_trade_constant)

    save_data(full_df, year0, year1, save_as)
