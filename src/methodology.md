<h1 class="header">
    Methodology
</h1>

<p class="normal-text">
    Trade data in current USD comes from CEPII's
    <a href="https://cepii.fr/CEPII/en/bdd_modele/bdd_modele_item.asp?id=37">
        BACI database
    </a>.
    This data is then grouped by product categories according to     
    <a href="https://www.wcoomd.org/en/topics/nomenclature/instrument-and-tools/hs-nomenclature-2022-edition/hs-nomenclature-2022-edition.aspx">HS Nomenclature</a>,
    such that each section constitutes a category.
</p>

<p class="normal-text">
    To convert figures into 2015 constant USD, we use GDP deflators and exchange rates from the IMF World Economic Outlook through the <a href="https://github.com/jm-rivera/pydeflate">pydeflate</a> package.
</p>

<p class="normal-text">
    Figures expressed as a percentage of GDP are calculated by dividing the trade value (in 2015 constant USD) by the GDP (also in 2015 constant USD) for that specific year and country. GDP figures are taken from the World Economic Outlook via the <a href="https://github.com/ONEcampaign/bblocks_data_importers">bblocks_data_importers</a> package and converted from current to 2015 constant USD using pydeflate.  
</p>

<p class="normal-text">
    The scripts to wrangle the data are included in the <span style="font-family: monospace">data_preparation</span> directory of the project's <a href="https://github.com/ONEcampaign/trade_data_explorer">GitHub repo</a>.
</p>




