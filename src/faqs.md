```js
import {groupMappings} from "./components/inputValues.js";

const sampleInfo = await FileAttachment("./data/scripts/country_aggregates.csv").csv({typed: true});

const NCountries = sampleInfo[0].n_countries
const GDPShare = sampleInfo[0].gdp_share.toFixed(1)
const PopulationShare = sampleInfo[0].pop_share.toFixed(1)
```

<div class="header card">
    <a class="view-button" href="./">
        Single Country
    </a>
    <a class="view-button" href="./multi">
        Multi Country
    </a>
    <a class="view-button active" href="./faqs">
        FAQs
    </a>
</div>

<div class="card methodology">
    <h2 class="section-header">
        What is the Trade Explorer?
    </h2>
    <p class="base-text">
        The <span class="italic">Trade Explorer</span> is a tool to help you analyze trade patterns for different 
        countries across the world. It provides to options: <span class="italic">Single Country</span> and 
        <span class="italic">Multi Country</span>
    </p> 
    <p class="base-text">
        <span class="bold">Single Country</span> provides an overview of a country's trade position with the rest of 
        the world.
    </p> 
    <p class="base-text">
        Note that due to data management constraints, <span class='italic'>Single Country</span> provides trade 
        information for ${NCountries} countries rather than the entire world. While not exhaustive, these countries 
        account for ${GDPShare}% of global GDP and ${PopulationShare}% of world population, making it a strong 
        approximation.
    </p>
    <p class="base-text">
        <span class="bold">Multi Country</span> lets you explore trade between a selected country and up to five trading 
        partners simultaneously. 
    </p>
    <p class="base-text">
        All trade figures are presented from the selected country’s perspective. For example, if you choose Botswana,
        exports indicate goods and services flowing out of Botswana to the selected partner, while imports represent
        inflows into Botswana. In this sense, exports are shown as positive values, indicating revenue from outgoing
        goods and services, while imports are negative values, reflecting expenditures on incoming goods and services.
    </p>
    <p class="base-text">
        If only one trading partner is selected, all trade flows (imports, exports and trade balance) will be shown. To
        allow for cleaner comparisons when multiple partners are selected, you can only visualize a single trade flow at
        a time.
    </p>
    <p class="base-text">
        To ensure that the data shown is accurate, certain options will be disabled depending on the selected 
        <span class="italic">Country</span> and <span class="italic">Partner(s)</span>. For instance, if France is 
        selected as <span class="italic">Country</span>, you won't be able to select France, EU27 countries, G7 
        countries or G20 countries as <span class="italic">Partner</span>, as these options overlap with France.
    </p>
    <h2 class="section-header">
        What countries are included in the different country groups?
    </h2>
    <ul class="group-list">
        ${
            Object.entries(groupMappings)
                .filter(([_, countries]) => countries.length > 1)
                .sort(([a], [b]) => a.localeCompare(b)) // Sort alphabetically by group name
                .map(([group, countries]) => html`<li><span class="group-name">${group}</span>: ${countries.join(", ")}.</li>`)
        }
    </ul>
    <h2 class="section-header">
        Where does the data come from?
    </h2>
    <p class="base-text">
        Trade data is retrieved from CEPII's
        <a href="https://cepii.fr/CEPII/en/bdd_modele/bdd_modele_item.asp?id=37">BACI database</a>
        and grouped by product category according to
        <a href="https://www.wcoomd.org/en/topics/nomenclature/instrument-and-tools/hs-nomenclature-2022-edition/hs-nomenclature-2022-edition.aspx">
            HS Nomenclature</a>,
        with each HS section forming a category.
    </p>
    <h2 class="section-header">
        How is the data transformed?
    </h2>
    <p class="base-text">
        The original trade figures are presented in current US Dollars. They are converted into other currencies and
        constant prices via
        <a href="https://github.com/jm-rivera/pydeflate">pydeflate</a>.
    </p>
    <p class="base-text">
        Figures expressed as a share of GDP are based on World Economic Outlook GDP data, retrieved via the
        <a href="https://github.com/ONEcampaign/bblocks_data_importers">bblocks_data_importers</a>.
        When data is grouped by year (e.g., in plots), the share of GDP refers to the GDP of the selected country or
        country
        group for that specific year. When grouped by product category (e.g., in tables), it refers to the combined
        GDP of the selected country or country group over the chosen time period.
    </p>
    <p class="base-text">
        The data preparation scripts are located in the <span style="font-family: monospace">src/data</span>
        directory of the project's <a href="https://github.com/ONEcampaign/trade-explorer"> GitHub
        repository</a>.
    </p>
    <h2 class="section-header">
        Who should I contact for questions and suggestions?
    </h2>
    <p class="base-text">
        Please refer your comments to miguel.haroruiz[at]one[dot]org.
    </p>
</div>
