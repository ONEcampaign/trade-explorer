import {html} from "npm:htl"
import {theme_Flat} from "./theme_Flat.js"
import {colorPalette} from "./colorPalette.js"

// Source: https://observablehq.com/@kasivisu4/range-slider
export function rangeInput(options = {}) {
    const {
        min = 0,
        max = 100,
        step = "any",
        value: defaultValue = [min, max],
        color,
        width,
        theme = theme_Flat,
        enableTextInput = false,
        label = ""
    } = options;

    const controls = {};
    const scope =
        "scope-" +
        (performance.now() + Math.random()).toString(32).replace(".", "-");
    const clamp = (a, b, v) => (v < a ? a : v > b ? b : v);

    const inputMin = html`<input type="number" id="min-input"  min=${min} max=${defaultValue[1]} step=${step} value=${defaultValue[0]} />`;
    inputMin.style = "width:5em; margin-right: var(--size-xs)";
    const inputMax = html`<input type="number" id="max-input"  min=${defaultValue[0]} max=${max} step=${step} value=${defaultValue[1]} />`;
    inputMax.style = "width:5em; margin-left: var(--size-xs)";

    // Will be used to sanitize values while avoiding floating point issues.
    const input = html`<input type=range ${{ min, max, step }}>`;

    const sliderContent = html`${
            enableTextInput ? inputMin : ""
    }<div class=${`${scope} range-slider`} style=${{
        color,
        width: width == null 
            ? null
            : typeof width === "number"
                ? `${width}px`
                : `${width}`
    }}>
        ${(controls.track = html`<div class="range-track">
            ${(controls.zone = html`<div class="range-track-zone">
                ${(controls.range = html`<div class="range-select" style="background:${colorPalette.inputTheme}"tabindex=0>
                    ${(controls.min = html`<div class="thumb thumb-min" tabindex=0>`)}
                    ${(controls.max = html`<div class="thumb thumb-max" tabindex=0>`)}
                `)}
            `)}
        `)}
        ${html`<style>${theme.replace(/:scope\b/g, "." + scope)}`}
    </div>${enableTextInput ? inputMax : ""}`;

    const dom = html`
        <div style="display: flex; align-items: left; justify-content: start; gap: 0em;">
            ${
                label   
                ? html`<label style="font-size: var(--size-m); font-weight: bold; padding: 5px 0 4px 0; width:120px; margin-right: 6.5px;">${label}</label>`
                : ""
            }
            ${sliderContent}
        </div>`;

    let value = [],
        changed = false;
    Object.defineProperty(dom, "value", {
        get: () => [...value],
        set: ([a, b]) => {
            value = sanitize(a, b);
            updateRange();
        }
    });

    const sanitize = (a, b) => {
        a = isNaN(a) ? min : ((input.value = a), input.valueAsNumber);
        b = isNaN(b) ? max : ((input.value = b), input.valueAsNumber);
        return [Math.min(a, b), Math.max(a, b)];
    };

    const updateRange = () => {
        const ratio = (v) => (v - min) / (max - min);
        dom.style.setProperty("--range-min", `${ratio(value[0]) * 100}%`);
        dom.style.setProperty("--range-max", `${ratio(value[1]) * 100}%`);
    };

    const dispatch = (name) => {
        dom.dispatchEvent(new Event(name, { bubbles: true }));
    };
    const setValue = (vmin, vmax) => {
        const [pmin, pmax] = value;
        value = sanitize(vmin, vmax);
        updateRange();
        // Only dispatch if values have changed.
        if (pmin === value[0] && pmax === value[1]) return;
        inputMin.value = value[0];
        inputMax.value = value[1];
        dispatch("input");
        changed = true;
    };

    inputMin.addEventListener("input", () => {
        if (+inputMin.value > +inputMax.value || +inputMin.value < min) {
            dom.appendChild(html`<please enter less>`);
            return;
        }
        inputMax.min = inputMin.value;
        setValue(inputMin.value, dom.value[1]);
    });

    inputMax.addEventListener("input", () => {
        if (+inputMax.value < +inputMin.value || +inputMax.value > max) {
            dom.appendChild(html`<please enter above>`);
            return;
        }

        inputMin.max = inputMax.value;
        setValue(dom.value[0], inputMax.value);
    });

    setValue(...defaultValue);

    // Mousemove handlers.
    const handlers = new Map([
        [
            controls.min,
            (dt, ov) => {
                const v = clamp(min, ov[1], ov[0] + dt * (max - min));
                setValue(v, ov[1]);
            }
        ],
        [
            controls.max,
            (dt, ov) => {
                const v = clamp(ov[0], max, ov[1] + dt * (max - min));
                setValue(ov[0], v);
            }
        ],
        [
            controls.range,
            (dt, ov) => {
                const d = ov[1] - ov[0];
                const v = clamp(min, max - d, ov[0] + dt * (max - min));
                setValue(v, v + d);
            }
        ]
    ]);

    // Returns client offset object.
    const pointer = (e) => (e.touches ? e.touches[0] : e);
    // Note: Chrome defaults "passive" for touch events to true.
    const on = (e, fn) =>
        e
            .split(" ")
            .map((e) => document.addEventListener(e, fn, { passive: false }));
    const off = (e, fn) =>
        e
            .split(" ")
            .map((e) => document.removeEventListener(e, fn, { passive: false }));

    let initialX,
        initialV,
        target,
        dragging = false;
    function handleDrag(e) {
        // Gracefully handle exit and reentry of the viewport.
        if (!e.buttons && !e.touches) {
            handleDragStop();
            return;
        }
        dragging = true;
        const w = controls.zone.getBoundingClientRect().width;
        e.preventDefault();
        handlers.get(target)((pointer(e).clientX - initialX) / w, initialV);
    }

    function handleDragStop(e) {
        off("mousemove touchmove", handleDrag);
        off("mouseup touchend", handleDragStop);
        if (changed) dispatch("change");
    }

    const observer = new MutationObserver((mutations) => {
        for (const mutation of mutations) {
            if (mutation.removedNodes.length > 0) {
                handleDragStop(); // Clean up when dom is removed
                observer.disconnect(); // Stop observing
                break;
            }
        }
    });
    observer.observe(document.body, {childList: true, subtree: true});

    dom.ontouchstart = dom.onmousedown = (e) => {
        dragging = false;
        changed = false;
        if (!handlers.has(e.target)) return;
        on("mousemove touchmove", handleDrag);
        on("mouseup touchend", handleDragStop);
        e.preventDefault();
        e.stopPropagation();

        target = e.target;
        initialX = pointer(e).clientX;
        initialV = value.slice();
    };

    controls.track.onclick = (e) => {
        if (dragging) return;
        changed = false;
        const r = controls.zone.getBoundingClientRect();
        const t = clamp(0, 1, (pointer(e).clientX - r.left) / r.width);
        const v = min + t * (max - min);
        const [vmin, vmax] = value,
            d = vmax - vmin;
        if (v < vmin) setValue(v, v + d);
        else if (v > vmax) setValue(v - d, v);
        if (changed) dispatch("change");
    };

    return dom;
}