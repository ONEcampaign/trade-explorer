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
    widen_currency_price,
    reshape_to_country_flow,
)


def load_mappings() -> tuple[
    dict[str, str],
    dict[str, str],
    dict[str, str],
    dict[str, list[str]],
    dict[str, list[str]],
    set[str],
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

    eligible_iso3 = {iso for members in group_to_iso3.values() for iso in members}

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
        eligible_iso3,
        membership_df,
    )


def filter_and_aggregate_data(
    raw_df: pd.DataFrame,
    product_code_to_section: dict[str, str],
    country_code_to_iso3: dict[str, str],
    eligible_iso3: set[str],
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

    eligible_mask = (
        df["exporter_iso3"].isin(eligible_iso3)
        & df["importer_iso3"].isin(eligible_iso3)
    )

    df = df[eligible_mask]

    df = (
        df.dropna(subset=["value"])
        .groupby(["year", "exporter_iso3", "importer_iso3", "category"], as_index=False)
        .agg({"value": "sum"})
    )

    df["value"] /= 1_000  # Convert from thousands to millions
    return df


def load_build_aggregated_trade(
    product_code_to_section: dict[str, str],
    country_code_to_iso3: dict[str, str],
    eligible_iso3: set[str],
) -> pd.DataFrame:
    """Load aggregated trade data from disk or build it from raw BACI files."""
    output_path: Path = PATHS.DATA / f"trade_{TIME_RANGE[0]}_{TIME_RANGE[1]}.parquet"

    if output_path.exists():
        logger.info("Loading aggregated BACI data from %s", output_path)
        cached = pd.read_parquet(output_path)
        mask = (
            cached["exporter_iso3"].isin(eligible_iso3)
            & cached["importer_iso3"].isin(eligible_iso3)
        )
        filtered_cached = cached.loc[mask].reset_index(drop=True)
        if len(filtered_cached) != len(cached):
            logger.info("Filtered cached BACI data to eligible ISO3 codes")
        return filtered_cached

    logger.info("Aggregating BACI data")
    frames: list[pd.DataFrame] = []
    for year in range(TIME_RANGE[0], TIME_RANGE[1] + 1):
        raw_path = PATHS.BACI / f"BACI_HS02_Y{year}_V{BACI_VERSION}.csv"
        raw_df = pd.read_csv(raw_path, dtype={"k": str})
        frames.append(
            filter_and_aggregate_data(
                raw_df,
                product_code_to_section,
                country_code_to_iso3,
                eligible_iso3,
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
        eligible_iso3,
        membership_df,
    ) = load_mappings()

    aggregated_wide = load_build_aggregated_trade(
        product_code_to_section,
        country_code_to_iso3,
        eligible_iso3,
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

    trade_df = widen_currency_price(
        df=trade_df,
        index_cols=(
            "year",
            "exporter",
            "exporter_iso3",
            "importer",
            "importer_iso3",
            "category",
        ),
    )
    trade_df = add_country_groups(trade_df, membership_df, group_to_iso3)

    trade_df = add_share_of_gdp(trade_df, country_iso3_to_name, group_to_iso3)

    trade_df = reshape_to_country_flow(trade_df)

    trade_df = convert_values_to_units(trade_df)

    return trade_df


def generate_input_values() -> None:
    """Materialise JS-ready data describing countries, groups, and HS categories."""

    logger.info("Generating input values file")

    (
        _,
        _,
        country_iso3_to_name,
        group_to_iso3,
        _,
        _,
        _,
    ) = load_mappings()

    with open(PATHS.HS_SECTIONS, "r", encoding="utf-8") as file:
        hs_sections_data = json.load(file)

    group_mappings = _build_group_mappings(group_to_iso3, country_iso3_to_name)
    base_categories = sorted(hs_sections_data.keys())
    category_names = ["All products", *base_categories]

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
    group_to_iso3: dict[str, list[str]],
    country_iso3_to_name: dict[str, str],
) -> dict[str, list[str]]:
    """Create a mapping of groups to their member countries (including self-entries)."""
    group_mappings: dict[str, set[str]] = {}

    member_iso = {code.upper() for members in group_to_iso3.values() for code in members}

    for iso in sorted(member_iso):
        country_name = country_iso3_to_name.get(iso, iso)
        group_mappings.setdefault(country_name, set()).add(country_name)

    for group, members in group_to_iso3.items():
        country_names = [country_iso3_to_name.get(code, code) for code in members]
        group_mappings.setdefault(group, set()).update(country_names)

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
    write_partitioned_dataset(df, "trade", partition_cols=["country"])
    logger.info("Trade data completed")
