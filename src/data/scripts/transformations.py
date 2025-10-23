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
    """Return the list of countries defined in the country-groups file."""
    with open(PATHS.COUNTRIES, "r") as f:
        country_to_groups = json.load(f)
    return sorted(country_to_groups.keys())


def generate_country_year_df(
    countries: Sequence[str], time_range: Sequence[int]
) -> pd.DataFrame:
    """Create a cartesian product of years and countries, adding ISO3 codes."""
    start_year, end_year = time_range[0], time_range[1]
    years = range(start_year, end_year + 1)
    combinations = itertools.product(years, countries)
    result = pd.DataFrame(combinations, columns=["year", "country"])

    cc = coco.CountryConverter()
    result["iso3_code"] = cc.pandas_convert(result["country"], to="ISO3")

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


def add_group_gdp(df: pd.DataFrame) -> pd.DataFrame:
    """Append GDP totals for each defined country group."""

    with open(PATHS.COUNTRIES, "r") as f:
        country_to_groups_raw: Mapping[str, Mapping[str, Sequence[str]]] = json.load(f)

    group_to_members: dict[str, set[str]] = {}
    for country, details in country_to_groups_raw.items():
        for group in details.get("groups", []):
            group_to_members.setdefault(group, set()).add(country)

    group_frames: list[pd.DataFrame] = []
    for group, members in group_to_members.items():
        subset = df[df["country"].isin(members)]
        if subset.empty:
            continue
        group_frames.append(
            subset.groupby("year", as_index=False)["gdp_current"]
            .sum()
            .assign(country=group)
        )

    df_groups = (
        pd.concat(group_frames, ignore_index=True) if group_frames else pd.DataFrame()
    )

    combined = pd.concat([df.copy(), df_groups], ignore_index=True)
    return combined.rename(columns={"country": "exporter"})


def add_share_of_gdp(df: pd.DataFrame) -> pd.DataFrame:
    """Attach GDP totals and compute export values as a share of GDP."""

    logger.info("Adding share of GDP column...")

    countries = load_countries()
    country_df = generate_country_year_df(countries, TIME_RANGE)
    gdp_df = load_format_weo()

    merged_df = country_df.merge(gdp_df, on=["iso3_code", "year"], how="left").drop(
        columns="iso3_code"
    )
    groups_df = add_group_gdp(merged_df)

    result = df.merge(groups_df, on=["exporter", "year"], how="left")
    share = result["value_usd_current"].div(result["gdp_current"])
    result["pct_of_gdp"] = share.mul(100)
    zero_or_missing = result["gdp_current"].isna() | (result["gdp_current"] == 0)
    result.loc[zero_or_missing, "pct_of_gdp"] = pd.NA

    return result.drop(columns="gdp_current")


def add_country_groups(df: pd.DataFrame, country_to_groups: dict) -> pd.DataFrame:
    """
    Build trade views for:
      - country→group
      - group→country
      - group→group (only between disjoint groups)
    Keeps original country→country rows.
    Assumes df has columns: year, exporter, importer, category, value
    country_to_groups: {country: {"groups": [group1, group2, ...]}, ...}
    """

    logger.info("Adding country groups...")

    # --- prep
    c2g = {c: list(v.get("groups", [])) for c, v in country_to_groups.items()}
    value_cols = [c for c in df.columns if c.startswith("value_")]
    # invert to group -> set of member countries
    g2c = {}
    for c, gs in c2g.items():
        for g in gs:
            g2c.setdefault(g, set()).add(c)

    base = df.copy()
    base["exporter_groups"] = base["exporter"].map(c2g).apply(lambda x: x or [])
    base["importer_groups"] = base["importer"].map(c2g).apply(lambda x: x or [])

    out = []

    # --- country → group (exclude country ∈ group)
    cg = base.explode("importer_groups").rename(
        columns={"importer_groups": "imp_group"}
    )
    if not cg["imp_group"].empty:
        mask = ~cg.apply(
            lambda r: r["exporter"] in g2c.get(r["imp_group"], set()), axis=1
        )
        cg = cg[mask]
        cg = (
            cg.groupby(["year", "category", "exporter", "imp_group"], as_index=False)[
                value_cols
            ]
            .sum()
            .rename(columns={"imp_group": "importer"})
        )
        out.append(cg)

    # --- group → country (exclude country ∈ group)
    gc = base.explode("exporter_groups").rename(
        columns={"exporter_groups": "exp_group"}
    )
    if not gc["exp_group"].empty:
        mask = ~gc.apply(
            lambda r: r["importer"] in g2c.get(r["exp_group"], set()), axis=1
        )
        gc = gc[mask]
        gc = (
            gc.groupby(["year", "category", "exp_group", "importer"], as_index=False)[
                value_cols
            ]
            .sum()
            .rename(columns={"exp_group": "exporter"})
        )
        out.append(gc)

    # --- group → group (groups must be disjoint: no overlapping members)
    gg = (
        base.explode("exporter_groups")
        .explode("importer_groups")
        .rename(
            columns={"exporter_groups": "exp_group", "importer_groups": "imp_group"}
        )
    )
    if not gg[["exp_group", "imp_group"]].empty:

        def disjoint(row):
            a = g2c.get(row["exp_group"], set())
            b = g2c.get(row["imp_group"], set())
            # exclude if any overlap
            return a.isdisjoint(b)

        gg = gg[gg.apply(disjoint, axis=1)]
        gg = (
            gg.groupby(["year", "category", "exp_group", "imp_group"], as_index=False)[
                value_cols
            ]
            .sum()
            .rename(columns={"exp_group": "exporter", "imp_group": "importer"})
        )
        out.append(gg)

        # --- keep original country → country
        cc = base.groupby(["year", "category", "exporter", "importer"], as_index=False)[
            value_cols
        ].sum()
        out.append(cc)

    result = pd.concat(out, ignore_index=True)

    return result
