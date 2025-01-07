import pandas as pd
from data_preparation.utils.paths import PATHS


def process_wdi_data(year0, year1):
    """Process the WDI data for African countries and return the cleaned DataFrame."""
    # Load WDI data
    wdi_raw = pd.read_csv(PATHS.WDI)

    # Filter for GDP constant 2015 USD
    wdi_gdp = wdi_raw[wdi_raw["Indicator Code"] == "NY.GDP.MKTP.KD"]

    # Rename specific countries
    wdi_gdp = wdi_gdp.replace(
        {
            "Egypt, Arab Rep.": "Egypt",
            "Central African Republic": "Central African Rep.",
            "Congo, Rep.": "Congo",
            "Congo, Dem. Rep.": "Dem. Rep. of the Congo",
            "Gambia, The": "Gambia",
            "Cote d'Ivoire": "Côte d'Ivoire",
            "Tanzania": "United Rep. of Tanzania",
        }
    )

    # Load list of African countries
    african_countries = pd.read_csv(PATHS.AFRICAN_COUNTRIES)["countries"]

    # Filter GDP data for African countries
    wdi_gdp_africa = wdi_gdp[wdi_gdp["Country Name"].isin(african_countries)]

    # Rename columns for clarity
    wdi_gdp_africa = wdi_gdp_africa.rename(columns={"Country Name": "country"})

    # Melt the data to long format
    wdi_gdp_africa_long = wdi_gdp_africa.melt(
        id_vars=["country"],
        value_vars=[str(year) for year in range(year0, year1 + 1)],
        var_name="year",
        value_name="constant_gdp_2015",
    )

    # Convert to million USD dollars
    wdi_gdp_africa_long["constant_gdp_2015"] = (
        wdi_gdp_africa_long["constant_gdp_2015"] / 1_000_000
    )

    return wdi_gdp_africa_long
