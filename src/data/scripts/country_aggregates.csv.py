from __future__ import annotations

import json
import sys
import bblocks_data_importers as bbdata
import country_converter as coco
import pandas as pd

from src.data.config import logger, PATHS, TIME_RANGE


def get_iso_codes() -> list[str]:
    """Return the ISO3 codes for the countries defined in the config file."""
    with open(PATHS.COUNTRIES, "r") as f:
        country_to_groups = json.load(f)
    countries = list(country_to_groups.keys())

    cc = coco.CountryConverter()
    iso_codes = cc.convert(countries, to="ISO3")

    return sorted(
        {
            code
            for code in iso_codes
            if isinstance(code, str) and code.lower() != "not found"
        }
    )


def load_filtered_weo() -> tuple[pd.DataFrame, pd.DataFrame]:
    """Load GDP and population for the latest year in the configured range."""
    weo = bbdata.WEO()
    df_raw = weo.get_data()

    cc = coco.CountryConverter()
    latest_year = TIME_RANGE[1]

    gdp = df_raw.query(
        "indicator_code == 'NGDPD' & year == @latest_year & unit == 'U.S. dollars'"
    )[["entity_name", "value"]]
    gdp["iso"] = cc.pandas_convert(gdp["entity_name"], to="ISO3")

    pop = df_raw.query("indicator_code == 'LP' & year == @latest_year")[
        ["entity_name", "value"]
    ]
    pop["iso"] = cc.pandas_convert(pop["entity_name"], to="ISO3")

    return gdp, pop


def compute_country_shares() -> pd.DataFrame:
    """Compute GDP and population coverage for the configured countries."""
    iso_codes = get_iso_codes()
    gdp, pop = load_filtered_weo()

    world_gdp_value = gdp.loc[gdp["entity_name"] == "World", "value"].sum()
    sample_gdp = gdp[gdp["iso"].isin(iso_codes)]["value"].sum()
    share_gdp = (sample_gdp / world_gdp_value * 100) if world_gdp_value else pd.NA

    world_pop_value = pop["value"].sum()
    sample_pop = pop[pop["iso"].isin(iso_codes)]["value"].sum()
    share_pop = (sample_pop / world_pop_value * 100) if world_pop_value else pd.NA

    return pd.DataFrame(
        [
            {
                "n_countries": len(iso_codes),
                "gdp_share": share_gdp,
                "pop_share": share_pop,
            }
        ]
    )


if __name__ == "__main__":
    logger.info("Computing country aggregates")
    compute_country_shares().to_csv(sys.stdout, index=False)
