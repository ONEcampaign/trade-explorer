import json
from pathlib import Path

import ftfy

import pandas as pd

from bblocks.places import resolve_places

from src.data.config import BACI_VERSION, PATHS, TIME_RANGE, logger
from src.data.scripts.helper_functions import (
    convert_values_to_units,
    write_partitioned_dataset,
)
from src.data.scripts.transformations import (
    add_country_groups,
    add_currencies_and_prices,
    add_share_of_gdp,
    reshape_to_country_flow,
)


def load_mappings() -> tuple[
    dict[str, str],
    dict[str, str],
    dict[str, str],
    dict[str, list[str]],
    dict[str, list[str]],
    pd.DataFrame,
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
    country_code_to_iso3 = dict(
        zip(country_codes["country_code"], country_codes["country_iso3"])
    )
    country_iso3_to_name = dict(
        zip(country_codes["country_iso3"], country_codes["country_name"])
    )

    with open(PATHS.COUNTRY_GROUPS, "r", encoding="utf-8") as f:
        group_to_iso3_raw = json.load(f)

    group_to_iso3 = {
        group: sorted({code.upper() for code in members})
        for group, members in group_to_iso3_raw.items()
    }

    iso3_to_groups: dict[str, list[str]] = {}
    for group, members in group_to_iso3.items():
        for iso in members:
            iso3_to_groups.setdefault(iso, []).append(group)

    iso3_to_groups = {iso: sorted(groups) for iso, groups in iso3_to_groups.items()}

    membership_rows = [
        (iso, group)
        for group, members in group_to_iso3.items()
        for iso in members
    ]
    membership_df = pd.DataFrame(membership_rows, columns=["iso3", "group"])

    return (
        product_code_to_section,
        country_code_to_iso3,
        country_iso3_to_name,
        group_to_iso3,
        iso3_to_groups,
        membership_df,
    )


def filter_and_aggregate_data(
    raw_df: pd.DataFrame,
    product_code_to_section: dict[str, str],
    country_code_to_iso3: dict[str, str]
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
    df["exporter_iso3"] = df["exporter"].map(country_code_to_iso3)
    df["importer_iso3"] = df["importer"].map(country_code_to_iso3)

    df = (
        df.dropna(subset=["value"])
        .groupby(["year", "exporter_iso3", "importer_iso3", "category"], as_index=False)
        .agg({"value": "sum"})
    )

    df["value"] /= 1_000  # Convert from thousands to millions

    return df


def load_build_aggregated_trade(
    product_code_to_section: dict[str, str],
    country_code_to_iso3: dict[str, str]
) -> pd.DataFrame:
    """Load aggregated trade data from disk or build it from raw BACI files."""
    output_path: Path = PATHS.DATA / f"trade_{TIME_RANGE[0]}_{TIME_RANGE[1]}.parquet"

    if output_path.exists():
        logger.info("Loading aggregated BACI data from %s", output_path)
        return pd.read_parquet(output_path)

    logger.info("Aggregating BACI data")
    frames: list[pd.DataFrame] = []
    for year in range(TIME_RANGE[0], TIME_RANGE[1] + 1):
        raw_path = PATHS.BACI / f"BACI_HS02_Y{year}_V{BACI_VERSION}.csv"
        raw_df = pd.read_csv(raw_path, dtype={"k": str})
        frames.append(
            filter_and_aggregate_data(
                raw_df,
                product_code_to_section,
                country_code_to_iso3
            )
        )

    aggregated = pd.concat(frames, ignore_index=True)
    aggregated_wide = (
        aggregated.pivot(
            index=["year", "exporter_iso3", "importer_iso3"],
            columns="category",
            values="value",
        )
        .reset_index()
        .rename_axis(columns=None)
    )
    logger.info("Saving aggregated BACI data to %s", output_path)
    aggregated_wide.to_parquet(output_path, index=False, compression="snappy")
    return aggregated_wide


def process_trade_data() -> pd.DataFrame:
    """Create the full trade dataset ready for Observable consumption."""
    logger.info("Processing trade data")
    (
        product_code_to_section,
        country_code_to_iso3,
        country_iso3_to_name,
        group_to_iso3,
        _iso3_to_groups,
        membership_df,
    ) = load_mappings()

    aggregated_wide = load_build_aggregated_trade(
        product_code_to_section,
        country_code_to_iso3
    )

    base_cols = ["year", "exporter_iso3", "importer_iso3"]

    aggregated = aggregated_wide.melt(
        id_vars=base_cols,
        var_name="category",
        value_name="value",
        ignore_index=True,
    ).dropna(subset=["value"])

    totals = (
        aggregated.groupby(base_cols, as_index=False)["value"]
        .sum()
        .assign(category="All products")
    )

    aggregated = pd.concat([aggregated, totals], ignore_index=True)

    trade_df = add_currencies_and_prices(aggregated, id_column="exporter_iso3")

    missing_map = {
        "SCG": "Serbia and Montenegro",
        "ANT": "Netherlands Antilles",
        "S19": "Asia, not else specified"
    }

    trade_df["exporter"] = resolve_places(
        trade_df["exporter_iso3"], from_type="iso3_code", to_type="name_short", not_found="ignore"
    ).fillna(trade_df["exporter_iso3"].map(missing_map))
    trade_df["importer"] = resolve_places(
        trade_df["importer_iso3"], from_type="iso3_code", to_type="name_short", not_found="ignore"
    ).fillna(trade_df["importer_iso3"].map(missing_map))

    trade_df = add_country_groups(trade_df, membership_df, group_to_iso3)

    trade_df = add_share_of_gdp(trade_df, country_iso3_to_name, group_to_iso3)

    trade_df = reshape_to_country_flow(trade_df)

    trade_df = convert_values_to_units(trade_df)

    return trade_df


def generate_input_values(trade_df: pd.DataFrame) -> None:
    """Materialise JS-ready data describing countries, groups, and HS categories."""

    logger.info("Generating input values file")

    with open(PATHS.COUNTRY_GROUPS, "r") as f:
        groups_to_iso3 = json.load(f)

    time_range = [min(trade_df["year"]), max(trade_df["year"])]
    unique_countries = sorted(trade_df["country"].unique())
    country_groups = sorted(groups_to_iso3.keys())
    unique_categories = sorted(trade_df["category"].unique())

    sections = [
        _list_to_js(time_range, "maxTimeRange"),
        _list_to_js(unique_countries, "countryOptions"),
        _list_to_js(country_groups, "countryGroups"),
        _list_to_js(unique_categories, "productCategories"),
    ]
    js_output = "\n".join(sections)

    path_to_save = PATHS.COMPONENTS / "inputValues.js"
    with open(path_to_save, "w", encoding="utf-8") as js_file:
        js_file.write(js_output)

    logger.info("Saving input values file to %s", path_to_save)


def _list_to_js(elements: list, var_name: str) -> str:
    """Format HS section names into a JavaScript array export."""
    items = ",\n".join(f'  "{e}"' for e in elements)
    return "\n".join(
        [
            f"export const {var_name} = [",
            items,
            "];",
        ]
    )


if __name__ == "__main__":
    df = process_trade_data()

    logger.info("Writing partitioned dataset...")
    write_partitioned_dataset(df, "trade", partition_cols=["country"])
    logger.info("Trade data completed")

    logger.info("Writing input values...")
    generate_input_values(df)
