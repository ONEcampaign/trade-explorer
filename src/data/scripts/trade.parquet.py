import sys

import json
import ftfy

import pandas as pd
import pyarrow as pa
import pyarrow.parquet as pq
from decimal import Decimal, ROUND_HALF_EVEN

from src.data.config import logger, PATHS, baci_version, time_range


def load_mappings():
    """
    Load mappings for product codes to HS sections and country codes to names.
    """
    logger.info("Loading mappings")
    with open(PATHS.HS_SECTIONS, "r") as f:
        hs_dict = json.load(f)
    product_code_to_section = {
        code: category for category, codes in hs_dict.items() for code in codes
    }

    country_codes = pd.read_csv(PATHS.COUNTRY_CODES)
    country_codes["country_name"] = country_codes["country_name"].apply(ftfy.fix_text)
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

    df["value"] /= 1_000  # Convert from thousands to millions
    return df

def to_decimal(val, precision=2):
    quantizer = Decimal("1." + "0" * precision)
    return Decimal(str(val)).quantize(quantizer, rounding=ROUND_HALF_EVEN)


def generate_parquet(df):

    cols = df.columns.tolist()
    category_cols = ["year", "exporter", "importer"]
    decimal_cols = [col for col in cols if col not in category_cols]

    for col in category_cols:
        df[col] = df[col].astype('category')

    for col in decimal_cols:
        df[col] = df[col].apply(lambda x: to_decimal(x))

    base_schema = [
        ("year", pa.dictionary(pa.int8(), pa.int16())),
        ("exporter", pa.dictionary(index_type=pa.int8(), value_type=pa.string())),
        ("importer", pa.dictionary(index_type=pa.int8(), value_type=pa.string())),
    ]

    dynamic_schema = [(col,  pa.decimal128(8, 2)) for col in decimal_cols]

    schema = pa.schema(base_schema + dynamic_schema)

    table = pa.Table.from_pandas(df, schema=schema, preserve_index=False)

    # Write PyArrow Table to Parquet
    buf = pa.BufferOutputStream()
    pq.write_table(table, buf, compression="snappy")

    # Get the Parquet bytes
    buf_bytes = buf.getvalue().to_pybytes()
    sys.stdout.buffer.write(buf_bytes)


def process_trade_data():
    logger.info("Processing trade data")
    product_code_to_section, country_code_to_name, country_to_groups = load_mappings()
    path_to_save = PATHS.DATA / f"trade_{time_range[0]}_{time_range[1]}.csv"
    if path_to_save.exists():
        logger.info(f"Loading aggregated BACI data from {path_to_save}")
        df = pd.read_csv(path_to_save)
    else:
        logger.info("Aggregating BACI data")
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
        df = df_agg.pivot(
            index=["year", "exporter", "importer"], columns="category", values="value"
        )
        df = df.reset_index().rename_axis(columns=None)

        logger.info(f"Saving aggregated BACI data to {path_to_save}")
        df.to_csv(path_to_save, index=False)

    generate_parquet(df)


def generate_input_values():
    """
    Reads JSON files containing country-group mappings and HS section categories,
    then generates a JavaScript file exporting timeRange, categories, and groupMappings.
    """

    logger.info("Generating input values file")

    # Load the countries JSON file
    with open(PATHS.COUNTRIES, "r", encoding="utf-8") as file:
        countries_data = json.load(file)

    # Load the HS sections JSON file
    with open(PATHS.HS_SECTIONS, "r", encoding="utf-8") as file:
        hs_sections_data = json.load(file)

    # Create the group mappings dictionary
    group_mappings = {}

    for country, details in countries_data.items():
        # Ensure each country appears as a standalone entry
        group_mappings[country] = [country]  # Example: "Australia": ["Australia"]

        # Map groups to countries
        for group in details.get("groups", []):
            group_mappings.setdefault(group, []).append(country)

    # Convert group mappings to JavaScript format
    js_group_mappings = "export const groupMappings = {\n"
    for group, countries in sorted(group_mappings.items()):  # Sort for consistency
        countries_list = ", ".join(f'"{country}"' for country in sorted(countries))
        js_group_mappings += f'  "{group}": [{countries_list}],\n'
    js_group_mappings += "};\n"

    # Convert HS section categories to JavaScript format
    categories = sorted(hs_sections_data.keys())  # Sorting for consistency
    js_categories = "export const categories = [\n"
    js_categories += ",\n".join(f'  "{category}"' for category in categories)
    js_categories += "\n];\n"

    # Define time range
    js_time_range = "export const timeRange = [\n"
    js_time_range += ",\n".join(f"  {year}" for year in time_range)
    js_time_range += "\n];\n"

    # Combine all JavaScript code
    js_output = f"{js_time_range}\n{js_categories}\n{js_group_mappings}"

    # Write to inputValues.js
    path_to_save = PATHS.COMPONENTS / "inputValues.js"
    with open(path_to_save, "w", encoding="utf-8") as js_file:
        js_file.write(js_output)

    logger.info(f"Saving input values file to {path_to_save}")


if __name__ == "__main__":
    generate_input_values()
    process_trade_data()
