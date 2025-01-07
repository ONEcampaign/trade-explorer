<h1 class="header">
    Methodology
</h1>

<p class="normal-text">
    All trade data comes from CEPII's
    <a href="https://cepii.fr/CEPII/en/bdd_modele/bdd_modele_item.asp?id=37">
        BACI database
    </a>
    and processed as follows: 
</p>
<ul class="normal-list">
    <li>
        Products are classified into categories according to the WCO's
        <a href="https://www.wcoomd.org/en/topics/nomenclature/instrument-and-tools/hs-nomenclature-2022-edition/hs-nomenclature-2022-edition.aspx">HS Nomenclature</a>.
    </li>
    <li>
        Current USD figures are converted into 2015 constant USD using
        <a href="https://github.com/jm-rivera/pydeflate">pydeflate</a>.
    </li>
    <li>
        Figures expressed as a percentage of GDP are calculated by dividing the trade value (in 2015 constant USD) by the GDP (also in 2015 constant USD) for that specific year and country. GDP data is taken from the World Bank's
        <a href="https://datacatalog.worldbank.org/search/dataset/0037712/World-Development-Indicators">World Development Indicators</a>.
    </li>

</ul>

