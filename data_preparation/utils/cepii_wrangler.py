import pandas as pd
import json
import country_converter as coco
from pydeflate import imf_cpi_deflate, set_pydeflate_path
from typing import Literal
from data_preparation.utils.paths import PATHS
from data_preparation.utils.wdi_wranggler import process_wdi_data


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


def process_africa_trade_data(
    year0: int, year1: int, save_as: Literal["none", "json", "csv"]
):
    """
    Process trade data between African countries and ONE market countries.
    """
    product_code_to_category, country_code_to_name = load_mappings()

    african_countries = pd.read_csv(PATHS.AFRICAN_COUNTRIES)["countries"].tolist()
    one_markets = [
        "USA",
        "Canada",
        "United Kingdom",
        "France",
        "Germany",
        "Belgium",
        "Italy",
    ]

    agg_data_path = PATHS.DATA / f"{year0}_{year1}_raw_cepii.csv"

    if agg_data_path.exists():
        agg_df = pd.read_csv(agg_data_path)
    else:
        dataframes = [
            filter_and_aggregate_data(
                pd.read_csv(
                    PATHS.BACI / f"/BACI_HS02_Y{year}_V202401b.csv", dtype={"k": str}
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

    # Separate and transform export/import data
    exp_df = agg_df[agg_df["exporter"].isin(african_countries)].rename(
        columns={"exporter": "country", "importer": "partner", "value": "exports"}
    )
    exp_df["exports"] /= 1000

    imp_df = agg_df[agg_df["importer"].isin(african_countries)].rename(
        columns={"importer": "country", "exporter": "partner", "value": "imports"}
    )
    imp_df["imports"] /= -1000

    # Merge export and import data
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

    # Convert country names to ISO3 codes
    cc = coco.CountryConverter()
    africa_trade_long["country_code"] = cc.convert(
        africa_trade_long["country"], to="ISO3"
    )

    # Apply GDP deflation
    set_pydeflate_path(PATHS.PYDEFLATE)
    africa_trade_constant = imf_cpi_deflate(
        data=africa_trade_long,
        base_year=2015,
        id_column="country_code",
        value_column="current_usd",
        target_value_column="constant_usd_2015",
    )
    africa_trade_constant["year"] = africa_trade_constant["year"].astype(int)
    africa_trade_constant.drop("country_code", axis=1, inplace=True)

    # Process WDI data and merge with trade data
    gdp_df = process_wdi_data(year0, year1)
    gdp_df["year"] = gdp_df["year"].astype(int)
    full_df = pd.merge(
        africa_trade_constant,
        gdp_df,
        on=["year", "country"],
        how="outer",
        validate="many_to_one",
    )

    full_df["pct_gdp"] = (
        full_df["constant_usd_2015"] / full_df["constant_gdp_2015"] * 100
    )

    path_to_save = PATHS.SAVED_DATA / f"africa_trade_{year0}_{year1}.{save_as}"
    if save_as == "json":
        path_to_save.write_text(full_df.to_json(orient="records"))
    elif save_as == "csv":
        full_df.to_csv(path_to_save, index=False)
    elif save_as == "none":
        return full_df
