import {html} from "npm:htl"
import {hex2rgb} from "./hex2rgb.js"
import {ONEPalette} from "./ONEPalette.js"
import {formatValue} from "./formatValue.js";

export function sparkbar(fillColor, alignment, globalMin, globalMax) {
    const range = globalMax - globalMin;
    const zeroPosition = Math.abs(globalMin) / range;

    return (x) => {
        const barWidth = (100 * Math.abs(x)) / range;

        const barStyle =
            alignment === "center"
                ? `
          position: absolute;
          height: 80%;
          top: 10%;
          background: ${hex2rgb(fillColor, 0.4)};
          width: ${barWidth}%;
          ${
                    x >= 0
                        ? `left: ${zeroPosition * 100}%;`
                        : `right: ${(1 - zeroPosition) * 100}%;`
                }
        `
                : `
          position: absolute;
          height: 80%;
          top: 10%;
          background: ${hex2rgb(fillColor, 0.4)};
          width: ${barWidth}%;
          ${alignment === "right" ? "right: 0;" : "left: 0;"};
        `;

        // Zero line style with full height
        const zeroLineStyle =
            alignment === "center"
                ? `
          position: absolute;
          height: 100%;
          width: 1px;
          background: ${hex2rgb(ONEPalette.midGrey, 0.5)};
          left: ${zeroPosition * 100}%;
        `
                : alignment === "right"
                    ? `
          position: absolute;
          height: 100%;
          width: 1px;
          background: ${hex2rgb(ONEPalette.midGrey, 0.5)};
          right: 0;
        `
                    : `
          position: absolute;
          height: 100%;
          width: 1px;
          background: ${hex2rgb(ONEPalette.midGrey, 0.5)};
          left: 0;
        `;

        // Text alignment based on alignment type
        const textAlignment =
            alignment === "center"
                ? "center"
                : alignment === "right"
                    ? "end" // Right-align text
                    : "start"; // Left-align text

        return html`
            <div style="
      position: relative;
      width: 100%;
      height: var(--size-l);
      background: none;
      display: flex;
      z-index: 0;
      align-items: center;
      justify-content: ${textAlignment};
      box-sizing: border-box;">
                <div style="${barStyle}"></div>
                <div style="${zeroLineStyle}"></div> <!-- Zero line -->
                <span style="
          position: relative;
          z-index: 0;
          font-size: var(--size-s);
          color: black;
          text-shadow: .5px .5px 0 ${ONEPalette.lightGrey};
          padding: 0 3px;">
          ${formatValue(x).label}
        </span>
            </div>`;
    };
}