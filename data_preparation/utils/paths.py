from pathlib import Path


class PATHS:
    """Class to store the paths to the data."""

    UTILS = Path.cwd() / "data_preparation" / "utils"
    HARMONISED_SYSTEM = UTILS / "harmonised_system.json"
    AFRICAN_COUNTRIES = UTILS / "african_countries.txt"
    AFRICAN_REGIONS = UTILS / "african_regions.json"

    DATA = Path.cwd() / "data_preparation" / "data"
    PYDEFLATE = DATA / "pydeflate"
    BACI = DATA / "BACI_HS02_V202401b"
    COUNTRY_CODES = BACI / "country_codes_V202401b.csv"