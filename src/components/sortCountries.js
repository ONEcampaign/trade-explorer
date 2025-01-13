export function sortCountries(array) {
    return array.sort((a, b) => {
        const priority = (str) => {
            if (str.endsWith("(total)")) return 1; // Highest priority
            if (str.endsWith("(region)")) return 2; // Second priority
            return 3; // Lowest priority
        };

        const priorityA = priority(a);
        const priorityB = priority(b);

        // Sort by priority first, then alphabetically if priorities are equal
        if (priorityA !== priorityB) {
            return priorityA - priorityB;
        }

        return a.localeCompare(b); // Default alphabetical sorting
    });
}