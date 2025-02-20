const ONEPalette = {
    teal0 : "#17858C",
    teal1: "#1A9BA3",
    teal4: "#9ACACD",
    orange0: "#FF5E1F",
    orange1: "#FF7F4C",
    orange4: "#FFB699",
    yellow0: "#F5BE29",
    yellow1: "#F7CE5B",
    yellow4: "#FAE29E",
    burgundy0: "#7A0018",
    burgundy1: "#A20021",
    burgundy4: "#FF1F4B",
    purple0: "#661450",
    purple1: "#73175A",
    purple2: "#991E79",
    purple4: "#D733AB",
};

export const customPalette = {
    imports: ONEPalette.teal1 ,
    exports: ONEPalette.yellow1 ,
    balance: ONEPalette.burgundy1 ,
    darkGrey: "#333333",
    midGrey: "#646464",
    lightGrey: "#E8E8E8",
    neutralGrey: "#c2c2c4",
}

export const singlePalette = {
    domain: ["imports", "exports", "balance"],
    range: [customPalette.imports, customPalette.exports, customPalette.balance]
}

export function setCustomColors() {
    const root = document.documentElement;

    // Set CSS variables for each color in the palette
    Object.entries(customPalette).forEach(([key, value]) => {
        root.style.setProperty(`--${key}`, value);
    });
}