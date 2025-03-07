```js
import {groupMappings} from "./components/inputValues.js";
```

<div class="title-container">
    <div class="title-logo">
        <a href="https://data.one.org/" target="_blank">
            <img src="./ONE-logo-black.png" alt="A black circle with ONE written in white thick letters.">
        </a>
    </div>
    <h1 class="title-text">
        Trade explorer
    </h1>
</div>

<div class="header card">
    <a class="view-button" href="./">
        Single Country
    </a>
    <a class="view-button" href="./multi">
        Multi Country
    </a>
    <a class="view-button active" href="./about">
        About
    </a>
</div>

<div class="card methodology">
    <h2 class="section-header">
        How to use
    </h2>
    <p class="normal-text">
        The tool provides two options to analyze international trade data; <span
            class="italic-span">Single Country</span> allows you to explore trade between a selected country and a
        single trading partner, whereas <span class="italic-span">Multi Country</span> lets you compare a country’s
        trade
        with multiple partners simultaneously.
    </p>
    <p class="normal-text">
        Begin by selecting a country or country group from the <span class="italic-span">Country</span> dropdown
        menu. All
        trade figures are presented from the selected country’s perspective. For example, if you choose Botswana,
        exports represent goods and services flowing out of Botswana to the selected partner, while imports
        represent
        inflows into Botswana. In this sense, exports are shown as positive values, indicating revenue from outgoing
        goods and services, while imports are negative values, reflecting expenditures on incoming goods and
        services.
    </p>
    <p class="normal-text">
        In <span class="italic-span">Multi Country</span>, you can select up to 5 trading partners. To allow for
        cleaner
        comparisons across them, you can only visualize a single trade flow (exports, imports or trade balance) at
        a time.
    </p>
    <p class="normal-text">
        To ensure that the data shown is accurate, certain options will be disabled depending on the selected <span
            class="italic-span">Country</span> and
        <span class="italic-span">Partner(s)</span>. For instance, if France is selected as <span
            class="italic-span">Country</span>, you won't be able to
        select France, EU27 countries, G7 countries or G20 countries as <span class="italic-span">Partner</span>, as
        these
        options overlap with France.
    </p>
    <h2 class="section-header">
        Country groups
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
        Methodology
    </h2>
    <p class="normal-text">
        Trade data is retrieved from CEPII's
        <a href="https://cepii.fr/CEPII/en/bdd_modele/bdd_modele_item.asp?id=37">BACI database</a>
        and grouped by product category according to
        <a href="https://www.wcoomd.org/en/topics/nomenclature/instrument-and-tools/hs-nomenclature-2022-edition/hs-nomenclature-2022-edition.aspx">
            HS Nomenclature</a>,
        with each HS section forming a category.
    </p>
    <p class="normal-text">
        The original trade figures are presented in current US Dollars. They are converted into other currencies and
        constant prices via
        <a href="https://github.com/jm-rivera/pydeflate">pydeflate</a>.
    </p>
    <p class="normal-text">
        Figures expressed as a share of GDP are based on World Economic Outlook GDP data, retrieved via the
        <a href="https://github.com/ONEcampaign/bblocks_data_importers">bblocks_data_importers</a>.
        When data is grouped by year (e.g., in plots), the share of GDP refers to the GDP of the selected country or
        country
        group for that specific year. When grouped by product category (e.g., in tables), it refers to the combined
        GDP of the selected country or country group over the chosen time period.
    </p>
    <p class="normal-text">
        The data preparation scripts are located in the <span style="font-family: monospace">src/data</span>
        directory of the project's <a href="https://github.com/ONEcampaign/trade_data_explorer"> GitHub
        repository</a>.
    </p>
    <h2 class="section-header">
        Contact
    </h2>
    <p class="normal-text">
        For questions or suggestions, please contact miguel.haroruiz[at]one[dot]org.
    </p>
</div>
