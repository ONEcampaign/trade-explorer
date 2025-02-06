import pandas as pd
import json
import logging
import ftfy

from scripts.config import PATHS, baci_version, time_range

logging.getLogger().setLevel(logging.INFO)

def load_mappings():
    """
    Load mappings for product codes to HS sections and country codes to names.
    """
    logging.info("Loading mappings")
    with open(PATHS.HS_SECTIONS, "r") as f:
        hs_dict = json.load(f)
    product_code_to_section = {
        code: category for category, codes in hs_dict.items() for code in codes
    }

    country_codes = pd.read_csv(PATHS.COUNTRY_CODES)
    country_codes['country_name'] = country_codes['country_name'].apply(ftfy.fix_text)
    country_code_to_name = dict(
        zip(country_codes["country_code"], country_codes["country_name"])
    )

    with open(PATHS.COUNTRIES, "r") as f:
        country_to_groups = json.load(f)

    return product_code_to_section, country_code_to_name, country_to_groups


def filter_and_aggregate_data(
    raw_df, product_code_to_section, country_code_to_name, country_to_groups
):
    df = raw_df.rename(
        columns={
            "t": "year",
            "i": "exporter",
            "j": "importer",
            "k": "product",
            "v": "value",
        }
    )

    df["category"] = df["product"].str[:2].map(product_code_to_section)
    df["exporter"] = df["exporter"].map(country_code_to_name)
    df["importer"] = df["importer"].map(country_code_to_name)

    df = df[
        df["importer"].isin(list(country_to_groups.keys()))
        & df["exporter"].isin(list(country_to_groups.keys()))
    ]

    df = df.groupby(["year", "exporter", "importer", "category"], as_index=False).agg(
        {"value": "sum"}
    )

    df["value"] /= 1000
    return df


def save_data(df: pd.DataFrame):
    """
    Saves the final processed data in the desired format (json, csv, parquet or none).
    """

    path_to_save = PATHS.DATA / f"trade_{time_range[0]}_{time_range[1]}.csv"
    logging.info(f"Saving data to {path_to_save}")
    df.to_csv(path_to_save, index=False)


def process_trade_data():
    logging.info("Processing trade data")
    product_code_to_section, country_code_to_name, country_to_groups = load_mappings()
    agg_data_path = PATHS.DATA / f"raw_cepii_{time_range[0]}_{time_range[1]}.csv"
    if agg_data_path.exists():
        logging.info(f"Loading aggregated BACI data from {agg_data_path}")
        df = pd.read_csv(agg_data_path)
    else:
        logging.info("Aggregating BACI data")
        dataframes = [
            filter_and_aggregate_data(
                pd.read_csv(
                    PATHS.BACI / f"BACI_HS02_Y{year}_{baci_version}.csv",
                    dtype={"k": str},
                ),
                product_code_to_section,
                country_code_to_name,
                country_to_groups,
            )
            for year in range(time_range[0], time_range[1] + 1)
        ]


        df_agg = pd.concat(dataframes, ignore_index=True)
        df = df_agg.pivot(index=["year", "exporter", "importer"], columns="category", values="value")
        df = df.reset_index().rename_axis(columns=None)

        logging.info(f"Saving aggregated BACI data to {agg_data_path}")
        df.to_csv(agg_data_path, index=False)

    save_data(df)


if __name__ == "__main__":
    process_trade_data()  # df = pd.read_csv("./scripts/data/trade_2002_2023.csv")


