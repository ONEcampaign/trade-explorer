import itertools
import json
from collections.abc import Sequence
from typing import Mapping

import bblocks_data_importers as bbdata
import country_converter as coco
import pandas as pd

from pydeflate import imf_exchange, imf_gdp_deflate, set_pydeflate_path

from src.data.config import BASE_YEAR, CURRENCIES, PATHS, TIME_RANGE, logger

set_pydeflate_path(PATHS.PYDEFLATE)


def add_currencies_and_prices(df: pd.DataFrame, id_column: str) -> pd.DataFrame:
    """Expand trade values across the configured currencies and price bases."""
    base_df = df.assign(currency="USD", price="current")

    current_frames = [
        _convert_current_currency(base_df, currency, id_column)
        for currency in CURRENCIES
    ]

    constant_frames = [
        _convert_constant_currency(base_df, currency, id_column)
        for currency in CURRENCIES
    ]

    return pd.concat(current_frames + constant_frames, ignore_index=True)


def _convert_current_currency(
    base_df: pd.DataFrame, currency: str, id_column: str
) -> pd.DataFrame:
    """Convert values into current prices for the requested currency."""
    logger.info("Converting to %s (current prices)", currency)
    if currency == "USD":
        return base_df.assign(currency=currency, price="current")

    converted = imf_exchange(
        data=base_df.copy(),
        source_currency="USA",
        target_currency=currency,
        id_column=id_column,
    )
    return converted.assign(currency=currency, price="current")


def _convert_constant_currency(
    base_df: pd.DataFrame, currency: str, id_column: str
) -> pd.DataFrame:
    """Convert values into constant prices for the requested currency."""
    logger.info("Converting to %s (constant prices, base %s)", currency, BASE_YEAR)
    converted = imf_gdp_deflate(
        data=base_df.copy(),
        base_year=BASE_YEAR,
        source_currency="USA",
        target_currency=currency,
        id_column=id_column,
    )
    return converted.assign(currency=currency, price="constant")


def widen_currency_price(
    df: pd.DataFrame,
    index_cols: tuple[str, ...],
) -> pd.DataFrame:
    """Pivot currency/price pairs into wide value columns.

    Args:
        df: Long-form DataFrame with columns: year, donor_code, indicator, currency, price, value.
        index_cols: Columns to keep as the row index in the wide table.

    Returns:
        Wide DataFrame where columns are like 'USD_current_value', 'USD_constant_value', etc.
    """
    df = df.copy()

    # Pre-process values in long format (much faster than on wide data)
    df["value"] = df["value"].round(4).astype("float32")

    # Check for duplicates before pivoting and aggregate if found
    pivot_cols = list(index_cols) + ["currency", "price"]
    logger.info("Checking for duplicates before pivot...")
    duplicates = df[pivot_cols].duplicated()

    if duplicates.any():
        logger.warning(f"Found {duplicates.sum():,} duplicate rows before pivoting")
        logger.info("Aggregating duplicates by summing values...")
        # Aggregate duplicates by grouping and summing
        df = (
            df.groupby(pivot_cols, dropna=False, observed=True)["value"]
            .sum()
            .reset_index()
        )
        logger.info(f"After aggregation: {len(df):,} rows")
    else:
        logger.info("No duplicates detected - proceeding with pivot")

    wide = df.pivot(
        index=list(index_cols),
        columns=["currency", "price"],
        values="value",
    )

    # Flatten MultiIndex columns -> "value_usd_current"
    wide.columns = [
        f"value_{cur.lower()}_{price}" for cur, price in wide.columns.to_list()
    ]
    wide = wide.reset_index()

    value_cols = sorted([c for c in wide.columns if c not in index_cols])

    # Drop any columns that have 0 values
    wide = wide.loc[~(wide[value_cols] == 0).any(axis=1)]
    # Reorder columns: index cols first, then sorted value cols
    wide = wide[list(index_cols) + value_cols]

    return wide


def load_countries() -> list[str]:
    """Return the ISO3 codes configured across all country groups."""
    with open(PATHS.COUNTRY_GROUPS, "r", encoding="utf-8") as f:
        group_to_members = json.load(f)

    iso3_codes = {
        code.upper() for members in group_to_members.values() for code in members
    }

    return sorted(iso3_codes)


def generate_country_year_df(
    countries: Sequence[str], time_range: Sequence[int]
) -> pd.DataFrame:
    """Create a cartesian product of years and ISO3 codes."""
    start_year, end_year = time_range[0], time_range[1]
    years = range(start_year, end_year + 1)
    combinations = itertools.product(years, countries)
    result = pd.DataFrame(combinations, columns=["year", "iso3_code"])
    result["iso3_code"] = result["iso3_code"].str.upper()

    return result


def load_format_weo() -> pd.DataFrame:
    """Retrieve nominal GDP from the IMF WEO dataset and harmonise it."""
    weo = bbdata.WEO()
    df_raw = weo.get_data()

    df = df_raw.query("indicator_code == 'NGDPD' & unit == 'U.S. dollars'")[
        ["year", "entity_name", "value"]
    ]

    cc = coco.CountryConverter()
    df["iso3_code"] = cc.pandas_convert(df["entity_name"], to="ISO3")

    df = df.rename(columns={"value": "gdp_current"}).drop(columns="entity_name")

    df["gdp_current"] *= 1_000  # Convert from billions to millions

    return df


def add_group_gdp(
    df: pd.DataFrame,
    group_to_iso: Mapping[str, Sequence[str]],
    iso3_to_name: Mapping[str, str],
) -> pd.DataFrame:
    """Append GDP totals for each defined country group."""

    df = df.copy()
    df["iso3_code"] = df["iso3_code"].str.upper()
    df["exporter"] = df["iso3_code"].map(iso3_to_name).fillna(df["iso3_code"])

    country_frames: list[pd.DataFrame] = [df[["year", "exporter", "gdp_current"]]]
    for group, members in group_to_iso.items():
        member_set = {code.upper() for code in members}
        subset = df[df["iso3_code"].isin(member_set)]
        if subset.empty:
            continue
        group_totals = (
            subset.groupby("year", as_index=False)["gdp_current"]
            .sum()
            .assign(exporter=group)
        )
        country_frames.append(group_totals)

    return pd.concat(country_frames, ignore_index=True)


def add_share_of_gdp(
    df: pd.DataFrame,
    country_iso3_to_name: Mapping[str, str],
    group_to_iso: Mapping[str, Sequence[str]],
) -> pd.DataFrame:
    """Attach GDP totals and compute export/import values as a share of GDP."""

    logger.info("Adding share of GDP columns (exporter & importer)...")

    countries: set[str] = set(load_countries())
    if "exporter_iso3" in df.columns:
        countries.update(df["exporter_iso3"].dropna().astype(str).str.upper().tolist())
    if "importer_iso3" in df.columns:
        countries.update(df["importer_iso3"].dropna().astype(str).str.upper().tolist())

    country_df = generate_country_year_df(sorted(countries), TIME_RANGE)
    gdp_df = load_format_weo()

    merged_df = country_df.merge(gdp_df, on=["iso3_code", "year"], how="left")
    groups_df = add_group_gdp(merged_df, group_to_iso, country_iso3_to_name)

    # Share relative to exporter GDP
    result = df.merge(groups_df, on=["exporter", "year"], how="left")
    exporter_share = result["value_usd_current"].div(result["gdp_current"])
    result["pct_of_gdp_exporter"] = exporter_share.mul(100)
    zero_or_missing = result["gdp_current"].isna() | (result["gdp_current"] == 0)
    result.loc[zero_or_missing, "pct_of_gdp_exporter"] = pd.NA
    if "gdp_current" in result.columns:
        result = result.drop(columns="gdp_current")

    # Share relative to importer GDP
    importer_gdp = groups_df.rename(
        columns={
            "exporter": "importer",
            "gdp_current": "gdp_current_importer",
        }
    )
    result = result.merge(importer_gdp, on=["importer", "year"], how="left")
    importer_share = result["value_usd_current"].div(result["gdp_current_importer"])
    result["pct_of_gdp_importer"] = importer_share.mul(100)
    zero_or_missing_imp = result["gdp_current_importer"].isna() | (
        result["gdp_current_importer"] == 0
    )
    result.loc[zero_or_missing_imp, "pct_of_gdp_importer"] = pd.NA
    if "gdp_current_importer" in result.columns:
        result = result.drop(columns="gdp_current_importer")

    # Preserve legacy column for exporter share
    result["pct_of_gdp"] = result["pct_of_gdp_exporter"]

    return result


def add_country_groups(
    df: pd.DataFrame,
    membership: pd.DataFrame,
    group_to_iso: Mapping[str, Sequence[str]],
) -> pd.DataFrame:
    """
    Build trade views for:
      - country→group
      - group→country
      - group→group (only between disjoint groups)
    Keeps original country→country rows.

    Args:
        df: DataFrame with trade values in wide format (value_* columns).
        membership: DataFrame linking ISO3 codes to group names (columns: iso3, group).
        group_to_iso: Mapping of group names to their member ISO3 codes.
    """

    logger.info("Adding country groups...")

    value_cols = [c for c in df.columns if c.startswith("value_")]

    base = df.copy()
    for col in ["exporter_iso3", "importer_iso3"]:
        if col not in base.columns:
            base[col] = pd.NA
        base[col] = base[col].astype("string").str.upper()

    membership = membership.copy()
    membership["iso3"] = membership["iso3"].astype("string").str.upper()
    membership_flag = membership.assign(_member_flag=True)

    importer_membership = membership.rename(
        columns={"iso3": "importer_iso3", "group": "importer_group"}
    )
    exporter_membership = membership.rename(
        columns={"iso3": "exporter_iso3", "group": "exporter_group"}
    )

    outputs: list[pd.DataFrame] = []

    # --- country → group (exclude country ∈ group)
    cg = base.merge(importer_membership, on="importer_iso3", how="inner")
    if not cg.empty:
        overlap_flag = membership_flag.rename(
            columns={
                "iso3": "exporter_iso3",
                "group": "importer_group",
                "_member_flag": "_has_overlap",
            }
        )
        cg = cg.merge(
            overlap_flag,
            on=["exporter_iso3", "importer_group"],
            how="left",
        )
        cg = cg[cg["_has_overlap"].isna()].drop(columns=["_has_overlap", "importer"])
        if not cg.empty:
            cg = (
                cg.groupby(
                    [
                        "year",
                        "category",
                        "exporter",
                        "exporter_iso3",
                        "importer_group",
                    ],
                    as_index=False,
                )[value_cols]
                .sum()
            )
            cg = cg.rename(columns={"importer_group": "importer"})
            cg["importer_iso3"] = pd.NA
            outputs.append(cg)

    # --- group → country (exclude country ∈ group)
    gc = base.merge(exporter_membership, on="exporter_iso3", how="inner")
    if not gc.empty:
        overlap_flag = membership_flag.rename(
            columns={
                "iso3": "importer_iso3",
                "group": "exporter_group",
                "_member_flag": "_has_overlap",
            }
        )
        gc = gc.merge(
            overlap_flag,
            on=["importer_iso3", "exporter_group"],
            how="left",
        )
        gc = gc[gc["_has_overlap"].isna()].drop(columns=["_has_overlap", "exporter"])
        if not gc.empty:
            gc = (
                gc.groupby(
                    [
                        "year",
                        "category",
                        "exporter_group",
                        "importer",
                        "importer_iso3",
                    ],
                    as_index=False,
                )[value_cols]
                .sum()
            )
            gc = gc.rename(columns={"exporter_group": "exporter"})
            gc["exporter_iso3"] = pd.NA
            outputs.append(gc)

    # --- group → group (groups must be disjoint: no overlapping members)
    gg = base.merge(exporter_membership, on="exporter_iso3", how="inner")
    gg = gg.merge(importer_membership, on="importer_iso3", how="inner")
    if not gg.empty:
        member_sets = {
            group: {code.upper() for code in members}
            for group, members in group_to_iso.items()
        }
        overlap_pairs: set[tuple[str, str]] = set()
        for exp_group, exp_members in member_sets.items():
            for imp_group, imp_members in member_sets.items():
                if not exp_members.isdisjoint(imp_members):
                    overlap_pairs.add((exp_group, imp_group))

        if overlap_pairs:
            overlap_df = pd.DataFrame(
                list(overlap_pairs),
                columns=["exporter_group", "importer_group"],
            ).assign(_has_overlap=True)
            gg = gg.merge(
                overlap_df,
                on=["exporter_group", "importer_group"],
                how="left",
            )
            gg = gg[gg["_has_overlap"].isna()].drop(columns="_has_overlap")

        if not gg.empty:
            gg = gg.drop(columns=["exporter", "importer"])
            gg = (
                gg.groupby(
                    ["year", "category", "exporter_group", "importer_group"],
                    as_index=False,
                )[value_cols]
                .sum()
            )
            gg = gg.rename(
                columns={
                    "exporter_group": "exporter",
                    "importer_group": "importer",
                }
            )
            gg["exporter_iso3"] = pd.NA
            gg["importer_iso3"] = pd.NA
            outputs.append(gg)

    # --- keep original country → country
    cc = base.groupby(
        [
            "year",
            "category",
            "exporter_iso3",
            "exporter",
            "importer_iso3",
            "importer",
        ],
        as_index=False,
    )[value_cols].sum()
    outputs.append(cc)

    outputs = [frame for frame in outputs if not frame.empty]
    if not outputs:
        return base.copy()

    result = pd.concat(outputs, ignore_index=True)

    for col in ["exporter", "importer", "exporter_iso3", "importer_iso3"]:
        if col in result.columns:
            result[col] = result[col].astype("string")

    return result


def reshape_to_country_flow(df: pd.DataFrame) -> pd.DataFrame:
    """Duplicate rows to create explicit exports/imports per country-partner pair."""

    logger.info("Reshaping trade data to country/partner/flow structure...")

    value_cols = [c for c in df.columns if c.startswith("value_")]
    base_cols = [c for c in df.columns if c not in value_cols]

    # Ensure required share columns exist
    if (
        "pct_of_gdp_exporter" not in df.columns
        or "pct_of_gdp_importer" not in df.columns
    ):
        raise KeyError("Expected pct_of_gdp_exporter and pct_of_gdp_importer columns")

    exports = df[base_cols].copy()
    exports[value_cols] = df[value_cols].to_numpy(copy=True)
    exports["country"] = df["exporter"]
    exports["partner"] = df["importer"]
    exports["flow"] = "exports"
    exports["pct_flow"] = df["pct_of_gdp_exporter"]

    imports = df[base_cols].copy()
    imports[value_cols] = df[value_cols].to_numpy(copy=True)
    imports["country"] = df["importer"]
    imports["partner"] = df["exporter"]
    imports["flow"] = "imports"
    imports["pct_flow"] = df["pct_of_gdp_importer"]

    combined = pd.concat([exports, imports], ignore_index=True)

    # Drop legacy/share helper columns and original exporter/importer
    drop_cols = {
        "exporter",
        "importer",
        "exporter_iso3",
        "pct_of_gdp_exporter",
        "pct_of_gdp_importer",
        "pct_of_gdp",
    }
    combined = combined.drop(columns=[c for c in drop_cols if c in combined.columns])

    combined = combined.assign(flow=combined["flow"].astype("category"))

    combined["pct_of_gdp"] = combined.pop("pct_flow")

    ordered_cols = [
        "year",
        "country",
        "partner",
        "flow",
        "category",
        *value_cols,
        "pct_of_gdp",
    ]
    combined = combined[ordered_cols].sort_values(
        ["country", "partner", "flow", "year", "category"], kind="stable"
    )

    return combined
