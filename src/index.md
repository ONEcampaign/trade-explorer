```js 
import { FileAttachment } from "observablehq:stdlib";
const colfaxRegular = FileAttachment("./fonts/Colfax-Regular.woff")
const colfaxRegular2 = FileAttachment("./fonts/Colfax-Regular.woff2")
```

```js 
console.log(await colfaxRegular.url());
```

<h1 class="header">
    Trade Data Explorer
</h1>

<p class="normal-text">
    This tool lets you explore trade between African countries and ONE markets.
</p>

<p class="normal-text">
    All trade figures are presented from the perspective of African countries. This means that exports are outflows of goods and services from African countries to ONE markets, while imports are inflows. As a result, exports are always shown as positive dollar values, reflecting the inflow of money, whereas imports are shown as negative values.
</p>

<p class="normal-text">
    There are two options:
</p>

<ul class="normal-list">
    <li>
        <a href="./single-country" class="bold-text">Single country</a> allows you to explore trade between a single African country and a ONE market.
    </li>
    <li>
        <a href="/multi-country" class="bold-text">Multi country</a> lets you compare trade relationships of multiple African countries with a ONE market.
    </li>

</ul>