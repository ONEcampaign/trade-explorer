import * as Inputs from "npm:@observablehq/inputs";
import {html} from "npm:htl"

export function multiSelect(data, options = {}) {
    const { width, locale, disabled, label, placeholder } = Object.assign(
        {
            width: 240,
            disabled: false,
            placeholder: "Search…"
        },
        options
    );

    // Ensure we have the correct `keyof` and `valueof` functions
    const keyof = options.keyof ? options.keyof : isMap(data) ? first : identity;
    const valueof = options.valueof
        ? options.valueof
        : isMap(data)
            ? second
            : identity;

    // Define the keys and values for the selection
    const keys = getKeys(data, keyof);
    const values = getValues(data, valueof);

    // Initialize selected indices
    const initialIndices = Array.isArray(options.value)
        ? indicesFromValues(options.value)
        : [];

    let selectedIndices = new Set(initialIndices);

    const id = newId();
    const datalistId = `${id}-datalist`;
    const inputEl = html`<input id="${id}"
                                class="${blockClass}__input"
                                type="text"
                                list="${datalistId}"
                                placeholder=${placeholder}
                                disabled=${disabled}
    />`;
    const selectionEl = html`<ul class="${blockClass}__selected-items" region="status"></ul>`;
    const labelEl = label ? html`<label for="${id}">${label}</label>` : "";
    const datalistEl = html`<datalist id=${datalistId}></datalist>`;

    const form = html`<form class="${ns} ${blockClass}" disabled=${disabled}>
        ${labelEl}

        <div class="${blockClass}__wrapper">
            ${selectionEl}
            ${inputEl}
            ${datalistEl}
        </div>
    </form>`;

    function dispatchInputEvent() {
        form.dispatchEvent(new Event("input", { bubbles: true }));
    }

    function indicesFromValues(value) {
        let indices = [];
        value.forEach((v) => {
            const index = values.indexOf(v);
            if (index >= 0) {
                indices.push(index);
            }
        });
        return indices;
    }

    function oninput(event) {
        preventDefault(event);
        const pickedKey = event.target?.value;
        if (pickedKey) {
            const iOfIndex = keys.indexOf(pickedKey);
            if (iOfIndex >= 0) {
                inputEl.value = "";
                selectedIndices.add(iOfIndex);
                updateUI();
                dispatchInputEvent();
            }
        }
    }

    function removeIndex(index) {
        const result = selectedIndices.delete(index);
        if (result) {
            updateUI();
            dispatchInputEvent();
        }
    }

    function updateOptions() {
        datalistEl.innerHTML = null;
        const options = dataList(keys, selectedIndices);
        options.forEach((option) => datalistEl.append(option));
    }

    function updateSelectedPills() {
        selectionEl.innerHTML = null;
        let items = [];
        for (let i of selectedIndices) {
            const k = keys[i];
            items.push(html`<li class="${blockClass}__selected-item">
                <span class="${blockClass}__selected-item-label">${k}</span>
                <button class="${blockClass}__remove"
                        type="button"
                        title="Remove"
                        onclick=${() => removeIndex(i)}
                        disabled=${disabled}>
                    <span class="${blockClass}__icon">${icons.close()}</span>
                </button>
            </li>`);
        }
        items.forEach((el) => selectionEl.append(el));
    }

    function updateUI() {
        updateOptions();
        updateSelectedPills();
    }

    function generateValues() {
        let items = [];
        for (let i of selectedIndices) {
            items.push(values[i]);
        }
        return items;
    }

    form.onchange = preventDefault;
    form.oninput = oninput;
    form.onsubmit = preventDefault;

    attachStyles();
    updateUI();

    return Object.defineProperty(form, "value", {
        get() {
            return selectedIndices.size ? generateValues() : [];
        },
        set(value) {
            if (Array.isArray(value)) {
                const indices = indicesFromValues(value);
                selectedIndices = new Set(indices);
                updateUI();
                dispatchInputEvent();
            }
        }
    });
}

const dataList = (keys, selectedIndices) =>
    keys.reduce((acc, v, i) => {
        if (!selectedIndices.has(i)) {
            return [...acc, html`<option value=${v}></option>`];
        }
        return acc;
    }, [])

function getKeys(data, keyof) {
    if (isMap(data)) {
        return Array.from(data.keys()).map((k) => stringify(k));
    }

    let keys = [];
    data.forEach((d, i) => keys.push(stringify(keyof(d, i, data))));
    return keys;
}

function getValues(data, valueof) {
    if (isMap(data)) {
        return Array.from(data.values());
    }

    let values = [];
    data.forEach((d, i) => values.push(valueof(d, i, data)));
    return values;
}

const ns = Inputs.text().classList[0]

// Function to replace "oi-" with "yams-"
function getMsns(ns) {
    return ns.replace("oi-", "yams-");
}

// Generate the block class
const msns = getMsns(ns);
const blockClass = `${msns}-form`;

function  newId() {
    let nextId = 0;

    return function newId() {
        return `${msns}-${++nextId}`;
    };
}

function length(x) {
    return x == null ? null : typeof x === "number" ? `${x}px` : `${x}`;
}

function preventDefault(event) {
    event.preventDefault();
}

function identity(x) {
    return x;
}

function first([x]) {
    return x;
}

function second([, x]) {
    return x;
}

function isMap(data) {
    return data instanceof Map;
}

function stringify(x) {
    return x == null ? "" : `${x}`;
}

function pick(arr) {
    arr[Math.floor(Math.random() * arr.length)]
}

const icons = {
    close: () => {
        const svgNS = "http://www.w3.org/2000/svg";
        const svg = document.createElementNS(svgNS, "svg");
        svg.setAttribute("xmlns", svgNS);
        svg.setAttribute("width", "24");
        svg.setAttribute("height", "24");
        svg.setAttribute("viewBox", "0 0 24 24");
        svg.setAttribute("fill", "none");
        svg.setAttribute("stroke", "currentColor");
        svg.setAttribute("stroke-width", "2");
        svg.setAttribute("stroke-linecap", "round");
        svg.setAttribute("stroke-linejoin", "round");
        svg.setAttribute("class", "feather feather-x");

        const line1 = document.createElementNS(svgNS, "line");
        line1.setAttribute("x1", "18");
        line1.setAttribute("y1", "6");
        line1.setAttribute("x2", "6");
        line1.setAttribute("y2", "18");

        const line2 = document.createElementNS(svgNS, "line");
        line2.setAttribute("x1", "6");
        line2.setAttribute("y1", "6");
        line2.setAttribute("x2", "18");
        line2.setAttribute("y2", "18");

        svg.appendChild(line1);
        svg.appendChild(line2);

        return svg;
    }
};


function attachStyles(placeOfUseInvalidation) {
    const elId = `${msns}-style`;

    // Avoid adding the style element if it already exists
    if (document.getElementById(elId)) return;

    const style = document.createElement('style');
    style.id = elId;
    style.textContent = `
      .${blockClass} {
        --border-radius-100: 0.125rem;
        --border-radius-200: 0.25rem;
        --color-border: #b3b3b3;
        --color-bg: #f5f5f5;
        --color-bg-hover: #ffdfdf;
        --color-icon: #777;
        --color-icon-hover: #e7040f;
      }

      .${blockClass}[disabled] {
        cursor: not-allowed;
      }

      .${blockClass} input[type="text"] {
        width: inherit;
      }

      .${blockClass}__wrapper {
        border: 1px solid var(--color-border);
        border-radius: var(--border-radius-100);
        background-color: var(--color-bg);
        box-sizing: border-box;
        width: 200px;
      }

      .${blockClass}__selected-items {
        display: flex;
        flex-wrap: wrap;
        gap: 0.25rem;
        margin: 0;
      }
      .${blockClass}__selected-items:not(:empty) {
        border-block-end: 1px solid var(--color-border);
        padding: 0.25rem;
      }
      .${blockClass}__selected-item {
        overflow: hidden;
        display: inline-flex;
        align-items: center;
        list-style: none;
        border: 1px solid var(--color-border);
        border-radius: var(--border-radius-200);
        padding-inline-start: 0.5rem;
        background-color: white;
        font-size: var(--size-s);
      }

      button.${blockClass}__remove {
        -webkit-appearance: none;
        -moz-appearance: none;
        appearance: none;
        background: transparent;
        border: 0;
        padding: 0.25rem;
        margin: 0;
        margin-inline-start: 0.5rem;
        line-height: 1;
        border-inline-start: 1px solid var(--color-border);
        color: var(--color-icon);
      }

      .${blockClass}__remove:hover:not([disabled]),
      .${blockClass}__remove:active:not([disabled]),
      .${blockClass}__remove:focus:not([disabled]) {
        background-color: var(--color-bg-hover);
        color: var(--color-icon-hover);
      }

      .${blockClass}__icon {
        display: inline-block;
        width: 16px;
        height: 16px;
        position: relative;
        vertical-align: middle;
      }

      .${blockClass}__icon svg {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
      }

      .${blockClass}__input {
        margin: 0;
        padding: 0.25rem;
        border: 0;
        border-radius: var(--border-radius-100);
        background: white;
      }

      /* Dirty fix for Firefox where the placeholder doesn't disappear sometimes */
      .${blockClass}__input:focus::-moz-placeholder { 
        color: transparent; 
      }

      .${blockClass}__input[disabled] {
        cursor: not-allowed;
      }
    `;

    document.head.appendChild(style);

    // Handle the removal of styles
    placeOfUseInvalidation?.then(() => style.remove());
}
