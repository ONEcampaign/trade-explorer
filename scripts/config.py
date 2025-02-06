from pathlib import Path

baci_version = "V202501"

time_range = [2002, 2023]


class PATHS:
    """Class to store the paths to the data."""

    PROJECT = Path(__file__).resolve().parent.parent

    SETTINGS = PROJECT / "scripts" / "settings"
    HS_SECTIONS = SETTINGS / "hs_sections.json"
    HS_CATEGORIES = SETTINGS / "hs_categories.json"
    COUNTRIES = SETTINGS / "countries.json"

    DATA = PROJECT / "scripts" / "data"
    PYDEFLATE = DATA / "pydeflate"
    BACI = DATA / f"BACI_HS02_{baci_version}"
    COUNTRY_CODES = BACI / f"country_codes_{baci_version}.csv"

    COMPONENTS = PROJECT / "src" / "components"
