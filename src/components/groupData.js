export function groupData(arrayData, isGDP, groupBy) {
    let totalGDP = 0;

    let groupedData = Object.values(arrayData.reduce((acc, entry) => {
        let { category, partner, imports, exports, balance, gdp } = entry;

        let key;
        if (groupBy === "category") {
            key = `${category}`;
            acc[key] = { category,  imports: 0, exports: 0, balance: 0 };
        } else if (groupBy === "category-partner") {
            key = `${category}||${partner}`;
            acc[key] = { category, partner, imports: 0, exports: 0, balance: 0 };
        }


        acc[key].imports += imports;
        acc[key].exports += exports;
        acc[key].balance += balance;

        if (isGDP) totalGDP += gdp;

        return acc;
    }, {}));

    if (isGDP) {
        groupedData.forEach(entry => {
            entry.imports = (entry.imports / totalGDP) * 100;
            entry.exports = (entry.exports / totalGDP) * 100;
            entry.balance = (entry.balance / totalGDP) * 100;
        });
    }

    return groupedData;
}