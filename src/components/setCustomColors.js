import {colorPalette} from "./colorPalette.js"

export function setCustomColors() {
    const root = document.documentElement;

    // Set CSS variables for each color in the palette
    Object.entries(colorPalette).forEach(([key, value]) => {
        root.style.setProperty(`--${key}`, value);
    });
}
