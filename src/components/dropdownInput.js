import * as Inputs from "npm:@observablehq/inputs";
import { html } from "npm:htl";

export function dropdownInput(config = {}) {

    // Set up configuration
    let {
        inputId,
        inputLabel,
        placeholderText,
        options,
        selected,
    } = config;

    options = options.map(value => ({ value: value, label: value }));

    const maxHeight = '250px';

    // Dropdown button
    const dropdownButton = Inputs.button(html`<div class='button-inner' style='display:flex;justify-content:space-between;height:100%;' id='dropdown-${inputId}'><div class='filter-selected' style='text-align:left;'>${placeholderText}</div><span style='font-size:10px;padding-left:5px;display:flex;align-items:center;'>${icons.arrowDown()}</span></div>`);
    dropdownButton.classList.add("dropdown-button");

    const optionValues = options.map(option => option.value);

    // Select input
    const selectInput = Inputs.select(optionValues, { multiple: true, value: selected });
    selectInput.classList.add("dropdown-select");
    selectInput.style.display = "none";

    // Select and deselect buttons
    const selectDeselectButtons = Inputs.button([["Select All", value => "Select All"], ["Deselect All", value => "Deselect All"]]);
    selectDeselectButtons.classList.add("dropdown-action-buttons");

    let selectInputValue = selected.slice(); // Create a copy of selected for selectInputValue

    // Create the option list items with initial selected status
    const optionListItems = options.map(option => {
        const isSelected = selectInputValue.includes(option.value);
        const listItem = html`<li id='${option.value}'><a style='cursor:pointer;'><span class='text'>${option.label}</span><span class='checkmark'>${icons.checkMark()}</span></a></li>`;

        const checkmarkSpan = listItem.querySelector('.checkmark');

        // Event listener for the list item
        listItem.addEventListener('click', (event) => {
            event.preventDefault();

            const clickedListItem = event.currentTarget;
            const clickedItemId = clickedListItem.id;
            const index = selectInputValue.indexOf(clickedItemId);

            if (clickedListItem.classList.contains('selected')) {
                clickedListItem.classList.remove('selected');
                if (index !== -1) {
                    selectInputValue.splice(index, 1);
                }
            } else {
                clickedListItem.classList.add('selected');
                selectInputValue.push(option.value);
            }

            // Update selectInput value
            selectInput.value = selectInputValue;

            // Update form value with selectInputValue
            form.value = selectInputValue;
            form.dispatchEvent(new CustomEvent("input", { bubbles: true }));

            // Reorder the list to move selected items to the top
            reorderOptionList();
        });

        // Add hover behavior to change the icon
        listItem.addEventListener('mouseover', () => {
            if (listItem.classList.contains('selected')) {
                checkmarkSpan.innerHTML = '';
                const crossMark = icons.crossMark();
                crossMark.setAttribute('fill', '#e7040f'); // Set color to #e7040f
                checkmarkSpan.appendChild(crossMark);
            }
        });

        listItem.addEventListener('mouseout', () => {
            if (listItem.classList.contains('selected')) {
                checkmarkSpan.innerHTML = '';
                const checkMark = icons.checkMark();
                checkmarkSpan.appendChild(checkMark);
            }
        });

        return { listItem, isSelected, value: option.value };
    });

    // Function to reorder the option list so selected items appear first
    function reorderOptionList() {
        // Sort optionListItems such that selected items come first, and order non-selected ones after
        const sortedItems = [
            ...optionListItems.filter(item => selectInputValue.includes(item.value)), // Selected items first
            ...optionListItems.filter(item => !selectInputValue.includes(item.value)), // Non-selected items second
        ];

        // Clear the existing list and append the sorted items
        const sortedList = html`<ul class='dropdown-list'>${sortedItems.map(item => item.listItem)}</ul>`;
        innerDropdown.querySelector('.dropdown-list-container').innerHTML = '';
        innerDropdown.querySelector('.dropdown-list-container').appendChild(sortedList);
    }

    // Create the dropdown content (innerDropdown) after the list items have been defined
    const innerDropdown = html`<div class='dropdown-action-buttons-container'>${selectDeselectButtons}</div>${selectInput} <div class='dropdown-list-container' style='max-height:${maxHeight};overflow-y:scroll;'>${optionListItems.map(item => item.listItem)}</div>`;

    innerDropdown.classList.add("dropdown-inner");
    innerDropdown.style.display = "none";

    // Function to toggle dropdown visibility
    const toggleDropdown = () => {
        innerDropdown.style.display = innerDropdown.style.display === "none" ? "block" : "none";
    };

    // Close the dropdown when clicking outside
    document.addEventListener("click", (event) => {
        if (!innerDropdown.contains(event.target) && !dropdownButton.contains(event.target)) {
            innerDropdown.style.display = "none";
        }
    });

    // Toggle the visibility of the select input on button click
    dropdownButton.onclick = (event) => {
        toggleDropdown();
    };

    optionListItems.forEach((t, index) => {
        const option = options[index].value;
        if (selectInputValue.includes(option)) {
            t.listItem.classList.add('selected');
        }
    });

    selectDeselectButtons.onclick = () => {
        const buttonText = selectDeselectButtons.value;
        if (buttonText === "Select All") {
            selectInput.value = options.map(option => option.value);
            selectInputValue = options.map(option => option.value);
            form.value = selectInputValue;

            optionListItems.forEach(t => {
                t.listItem.classList.add('selected');
            });
        } else if (buttonText === "Deselect All") {
            selectInput.value = [];
            selectInputValue = [];
            form.value = [];

            optionListItems.forEach(t => {
                t.listItem.classList.remove('selected');
            });
        }

        form.dispatchEvent(new CustomEvent("input", { bubbles: true }));
    };

    // Modified from inputs formula by https://observablehq.com/@jashkenas/inputs
    selectInput.onchange = e => {
        e && e.preventDefault();
        const value = selectInput.value;
        if (form.output) {
            const out = value;
            if (out instanceof window.Element) {
                while (form.output.hasChildNodes()) {
                    form.output.removeChild(form.output.lastChild);
                }
                form.output.append(out);
            } else {
                form.output.value = out;
            }
        }
        // Update form.value with the selectInput value
        form.value = value;
        form.dispatchEvent(new CustomEvent("input", { bubbles: true }));
    };

    const form = html`<label>${inputLabel}</label><form id=${inputId}>${dropdownButton} ${innerDropdown}</form>`;

    form.classList.add("dropdown-form");

    form.value = selected;

    const updatePlaceholderText = () => {
        const selectedValues = form.value;
        if (selectedValues.length > 0) {
            const filteredLabels = options
                .filter(option => selectedValues.includes(option.value))
                .map(filteredOption => {
                    // Check if the label is an HTML element
                    if (typeof filteredOption.label === 'object' && filteredOption.label instanceof HTMLElement) {
                        return filteredOption.label.outerHTML;
                    } else {
                        return filteredOption.label; // Assuming label is a string if not HTML
                    }
                });

            const concatenatedText = filteredLabels.join(', ');
            dropdownButton.querySelector('.filter-selected').innerHTML = `${concatenatedText}`;
        } else {
            dropdownButton.querySelector('.filter-selected').innerHTML = placeholderText;
        }
    };

    // Listen for changes in form.value
    form.addEventListener('input', updatePlaceholderText);

    // Initial update of placeholder text
    updatePlaceholderText();

    // Initial reorder to ensure selected items are at the top from the start
    reorderOptionList();

    return form;
}

const icons = {
    arrowDown: () => {
        const svgNS = "http://www.w3.org/2000/svg";
        const svg = document.createElementNS(svgNS, "svg");
        svg.setAttribute("xmlns", svgNS);
        svg.setAttribute("viewBox", "0 0 512 512");
        svg.setAttribute("width", "10"); // Optional size, can adjust as needed
        svg.setAttribute("height", "10"); // Optional size, can adjust as needed
        svg.setAttribute("fill", "currentColor");

        const path = document.createElementNS(svgNS, "path");
        path.setAttribute(
            "d",
            "M256 400L60 214c-10.5-10.5-10.5-27.7 0-38.2s27.7-10.5 38.2 0L256 322.1 412.2 168c10.5-10.5 27.7-10.5 38.2 0s10.5 27.7 0 38.2L256 400z"
        );

        svg.appendChild(path);
        return svg;
    },
    checkMark: () => {
        const svgNS = "http://www.w3.org/2000/svg";
        const svg = document.createElementNS(svgNS, "svg");
        svg.setAttribute("xmlns", svgNS);
        svg.setAttribute("viewBox", "0 0 448 512");
        svg.setAttribute("width", "16"); // Optional size, can adjust as needed
        svg.setAttribute("height", "16"); // Optional size, can adjust as needed
        svg.setAttribute("fill", "currentColor");

        const path = document.createElementNS(svgNS, "path");
        path.setAttribute(
            "d",
            "M438.6 105.4c12.5 12.5 12.5 32.8 0 45.3l-256 256c-12.5 12.5-32.8 12.5-45.3 0l-128-128c-12.5-12.5-12.5-32.8 0-45.3s32.8-12.5 45.3 0L160 338.7 393.4 105.4c12.5-12.5 32.8-12.5 45.3 0z"
        );

        svg.appendChild(path);
        return svg;
    },
    crossMark: () => {
        const svgNS = "http://www.w3.org/2000/svg";
        const svg = document.createElementNS(svgNS, "svg");
        svg.setAttribute("xmlns", svgNS);
        svg.setAttribute("viewBox", "0 0 512 512");
        svg.setAttribute("width", "16"); // Optional size, can adjust as needed
        svg.setAttribute("height", "16"); // Optional size, can adjust as needed
        svg.setAttribute("fill", "currentColor");

        const path = document.createElementNS(svgNS, "path");
        path.setAttribute(
            "d",
            "M376.6 84.5c11.3-13.6 9.5-33.8-4.1-45.1s-33.8-9.5-45.1 4.1L192 206 56.6 43.5C45.3 29.9 25.1 28.1 11.5 39.4S-3.9 70.9 7.4 84.5L150.3 256 7.4 427.5c-11.3 13.6-9.5 33.8 4.1 45.1s33.8 9.5 45.1-4.1L192 306 327.4 468.5c11.3 13.6 31.5 15.4 45.1 4.1s15.4-31.5 4.1-45.1L233.7 256 376.6 84.5z"
        );

        svg.appendChild(path);
        return svg;
    }

};
