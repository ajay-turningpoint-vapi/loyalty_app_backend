const fs = require("fs");

// Load the exported JSON file
const data = JSON.parse(fs.readFileSync("pointhistorybackup.json", "utf-8"));

// Remove only the `_id` field from each document
const cleaned = data.map(doc => {
  const { _id, ...rest } = doc;
  return rest;
});

// Save the cleaned data to a new file
fs.writeFileSync("pointhistories-clean.json", JSON.stringify(cleaned, null, 2));

console.log("✅ Cleaned file created: pointhistories-clean.json");
