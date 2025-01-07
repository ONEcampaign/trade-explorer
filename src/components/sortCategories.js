export function sortCategories(data, key = null) {
  return data.sort((a, b) => {
    // Extract category strings based on whether 'key' is provided
    const categoryA = key ? a?.[key] : a;
    const categoryB = key ? b?.[key] : b;

    // Handle null or undefined values by treating them as "infinity" (sorted last)
    if (!categoryA || !categoryB) return !categoryA ? 1 : -1;

    // Extract the leading numbers before the period
    const numA = parseInt(categoryA.split(".")[0], 10);
    const numB = parseInt(categoryB.split(".")[0], 10);

    // Compare the numbers numerically
    return numA - numB;
  });
}