const fs = require("fs");

// Load both JSON files
const firstCoupons = JSON.parse(fs.readFileSync("first_coupons.json", "utf-8"));
const secondCoupons = JSON.parse(fs.readFileSync("coupons.json", "utf-8"));

console.log(`📄 Total coupons in first_coupons.json: ${firstCoupons.length}`);
console.log(`📄 Total coupons in second_coupons.json: ${secondCoupons.length}`);

// Create a map from firstCoupons using the `name` as key
const firstMap = new Map(firstCoupons.map(doc => [doc.name, doc]));

// Track matches and unmatched
let matchCount = 0;
let unmatchedCount = 0;
const matchedNames = new Set();

const mergedCoupons = secondCoupons.map(doc => {
  const replacement = firstMap.get(doc.name);
  if (replacement && replacement.maximumNoOfUsersAllowed === 0) {
    matchCount++;
    matchedNames.add(doc.name);
    return replacement; // Replace with first file's document
  } else {
    unmatchedCount++;
    return doc; // Keep original
  }
});

// Find unused (non-matching or not satisfying condition) coupons in first file
const unusedInFirst = firstCoupons.filter(doc => !matchedNames.has(doc.name) && doc.maximumNoOfUsersAllowed === 0);

// Save the result
fs.writeFileSync("merged_coupons.json", JSON.stringify(mergedCoupons, null, 2), "utf-8");

// 🧾 Summary Log
console.log("✅ Merged coupons saved to merged_coupons.json\n");
console.log("📊 Summary:");
console.log(`🔁 Replaced coupons (matched by name + maximumNoOfUsersAllowed === 0): ${matchCount}`);
console.log(`🛑 Unmatched or not replaced coupons retained from second file: ${unmatchedCount}`);
console.log(`📦 Unused eligible coupons from first file (not matched or used): ${unusedInFirst.length}`);
