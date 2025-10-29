import json
from pathlib import Path

import ftfy

import pandas as pd

from src.data.config import BACI_VERSION, PATHS, TIME_RANGE, logger
from src.data.scripts.helper_functions import (
    convert_values_to_units,
    write_partitioned_dataset,
)
from src.data.scripts.transformations import (
    add_country_groups,
    add_currencies_and_prices,
    add_share_of_gdp,
    widen_currency_price,
)


def load_mappings() -> tuple[
    dict[str, str],
    dict[str, str],
    dict[str, str],
    dict[str, list[str]],
]:
    """Load product and country mappings required by the trade data pipeline."""
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
    country_name_to_iso3 = dict(
        zip(country_codes["country_name"], country_codes["country_iso3"])
    )

    with open(PATHS.COUNTRIES, "r") as f:
        country_to_groups = json.load(f)

    return (
        product_code_to_section,
        country_code_to_name,
        country_name_to_iso3,
        country_to_groups,
    )


def filter_and_aggregate_data(
    raw_df: pd.DataFrame,
    product_code_to_section: dict[str, str],
    country_code_to_name: dict[str, str],
    country_name_to_iso3: dict[str, str],
    country_to_groups: dict[str, list[str]],
) -> pd.DataFrame:
    """Apply reshaping, filtering, and aggregation to a raw BACI dataframe."""
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
    df["exporter_iso3"] = df["exporter"].map(country_name_to_iso3)
    df["importer"] = df["importer"].map(country_code_to_name)
    df["importer_iso3"] = df["importer"].map(country_name_to_iso3)

    eligible_countries = set(country_to_groups.keys())

    df = df[
        df["importer"].isin(eligible_countries)
        & df["exporter"].isin(eligible_countries)
    ]

    df = df.dropna(subset=["exporter", "importer", "category", "value"])

    df = df.groupby(
        ["year", "exporter", "exporter_iso3", "importer", "category"], as_index=False
    ).agg({"value": "sum"})

    df["value"] /= 1_000  # Convert from thousands to millions
    return df


def load_build_aggregated_trade(
    product_code_to_section: dict[str, str],
    country_code_to_name: dict[str, str],
    country_name_to_iso3: dict[str, str],
    country_to_groups: dict[str, list[str]],
) -> pd.DataFrame:
    """Load aggregated trade data from disk or build it from raw BACI files."""
    output_path: Path = PATHS.DATA / f"trade_{TIME_RANGE[0]}_{TIME_RANGE[1]}.csv"

    if output_path.exists():
        logger.info("Loading aggregated BACI data from %s", output_path)
        return pd.read_csv(output_path)

    logger.info("Aggregating BACI data")
    frames: list[pd.DataFrame] = []
    for year in range(TIME_RANGE[0], TIME_RANGE[1] + 1):
        raw_path = PATHS.BACI / f"BACI_HS02_Y{year}_V{BACI_VERSION}.csv"
        raw_df = pd.read_csv(raw_path, dtype={"k": str})
        frames.append(
            filter_and_aggregate_data(
                raw_df,
                product_code_to_section,
                country_code_to_name,
                country_name_to_iso3,
                country_to_groups,
            )
        )

    aggregated = pd.concat(frames, ignore_index=True)
    aggregated_wide = (
        aggregated.pivot(
            index=["year", "exporter", "exporter_iso3", "importer"],
            columns="category",
            values="value",
        )
        .reset_index()
        .rename_axis(columns=None)
    )
    logger.info("Saving aggregated BACI data to %s", output_path)
    aggregated_wide.to_csv(output_path, index=False)
    return aggregated_wide


def process_trade_data() -> pd.DataFrame:
    """Create the full trade dataset ready for Observable consumption."""
    logger.info("Processing trade data")
    (
        product_code_to_section,
        country_code_to_name,
        country_name_to_iso3,
        country_to_groups,
    ) = load_mappings()

    aggregated_wide = load_build_aggregated_trade(
        product_code_to_section,
        country_code_to_name,
        country_name_to_iso3,
        country_to_groups,
    )

    base_cols = ["year", "exporter", "exporter_iso3", "importer"]

    aggregated = aggregated_wide.melt(
        id_vars=base_cols,
        var_name="category",
        value_name="value",
        ignore_index=True,
    ).dropna(subset=["value"])

    trade_df = add_currencies_and_prices(aggregated, id_column="exporter_iso3")

    trade_df = widen_currency_price(
        df=trade_df,
        index_cols=("year", "exporter", "importer", "category"),
    )
    trade_df = add_country_groups(trade_df, country_to_groups)

    trade_df = add_share_of_gdp(trade_df)

    # Convert values to units (integers) for better compression
    # NOTE: Frontend queries must divide value_* columns by 1e6 to get millions
    trade_df = convert_values_to_units(trade_df)

    return trade_df


def generate_input_values() -> None:
    """Materialise JS-ready data describing countries, groups, and HS categories."""

    logger.info("Generating input values file")

    with open(PATHS.COUNTRIES, "r", encoding="utf-8") as file:
        countries_data = json.load(file)

    with open(PATHS.HS_SECTIONS, "r", encoding="utf-8") as file:
        hs_sections_data = json.load(file)

    group_mappings = _build_group_mappings(countries_data)
    category_names = sorted(hs_sections_data.keys())

    sections = [
        _format_time_range_js(TIME_RANGE),
        _format_categories_js(category_names),
        _format_group_mappings_js(group_mappings),
    ]
    js_output = "\n".join(sections)

    path_to_save = PATHS.COMPONENTS / "inputValues.js"
    with open(path_to_save, "w", encoding="utf-8") as js_file:
        js_file.write(js_output)

    logger.info("Saving input values file to %s", path_to_save)


def _build_group_mappings(
    countries_data: dict[str, dict[str, list[str]]],
) -> dict[str, list[str]]:
    """Create a mapping of groups to their member countries (including self-entries)."""
    group_mappings: dict[str, set[str]] = {}

    for country, details in countries_data.items():
        group_mappings.setdefault(country, set()).add(country)
        for group in details.get("groups", []):
            group_mappings.setdefault(group, set()).add(country)

    return {
        key: sorted(members)
        for key, members in sorted(group_mappings.items(), key=lambda item: item[0])
    }


def _format_group_mappings_js(group_mappings: dict) -> str:
    """Format group mappings into a JavaScript export statement."""
    lines = ["export const groupMappings = {"]
    for group, countries in group_mappings.items():
        countries_list = ", ".join(f'"{country}"' for country in countries)
        lines.append(f'  "{group}": [{countries_list}],')
    lines.append("};")
    return "\n".join(lines)


def _format_categories_js(categories: list) -> str:
    """Format HS section names into a JavaScript array export."""
    items = ",\n".join(f'  "{category}"' for category in categories)
    return "\n".join(
        [
            "export const productCategories = [",
            items,
            "];",
        ]
    )


def _format_time_range_js(time_range: list[int]) -> str:
    """Format TIME_RANGE into a JavaScript array export."""
    items = ",\n".join(f"  {year}" for year in time_range)
    return "\n".join(
        [
            "export const maxTimeRange = [",
            items,
            "];",
        ]
    )


if __name__ == "__main__":
    df = process_trade_data()

    logger.info("Writing partitioned dataset...")
    write_partitioned_dataset(df, "trade", partition_cols=["category"])
    logger.info("Trade data completed")
