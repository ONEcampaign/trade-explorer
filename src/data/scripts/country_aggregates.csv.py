import sys

import pandas as pd
import json

import country_converter as coco
import bblocks_data_importers as bbdata

from src.data.config import logger, PATHS, time_range


def get_iso_codes():

    with open(PATHS.COUNTRIES, "r") as f:
        country_to_groups = json.load(f)
        countries = list(country_to_groups.keys())

    cc = coco.CountryConverter()

    iso_codes = cc.convert(countries, to="ISO3")

    return iso_codes


def load_filter_weo():

    weo = bbdata.WEO()
    df_raw = weo.get_data()

    cc = coco.CountryConverter()

    gdp = df_raw.query(
        "indicator_code == 'NGDPD' &"
        "year == @time_range[1] &"
        "unit == 'U.S. dollars'"
    )[["entity_name", "value"]]

    gdp["iso"] = cc.pandas_convert(gdp["entity_name"], to="ISO3")

    pop = df_raw.query("indicator_code == 'LP' &" "year == @time_range[1]")[
        [
            "entity_name",
            "value",
        ]
    ]

    pop["iso"] = cc.pandas_convert(pop["entity_name"], to="ISO3")

    return gdp, pop


def get_shares():

    iso_codes = get_iso_codes()
    gdp, pop = load_filter_weo()

    world_gdp = gdp.query("entity_name == 'World'")["value"]
    sample_gdp = gdp.query("iso in @iso_codes")["value"].sum()

    share_gdp = sample_gdp / world_gdp * 100

    world_pop = pop["value"].sum()
    sample_pop = pop.query("iso in @iso_codes")["value"].sum()

    share_pop = sample_pop / world_pop * 100

    df = pd.DataFrame(
        {
            "n_countries": len(iso_codes),
            "gdp_share": share_gdp,
            "pop_share": share_pop,
        }
    ).reset_index()

    df.to_csv(sys.stdout, index=False)


if __name__ == "__main__":
    logger.info("Computing country aggregates")
    get_shares()
