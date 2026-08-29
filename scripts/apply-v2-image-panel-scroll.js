const fs = require("node:fs");
const path = require("node:path");

const filePath = path.join(__dirname, "..", "src", "renderer", "styles.css");
let source = fs.readFileSync(filePath, "utf8");
const before = `.image-grid {\n  display: grid;\n  grid-template-columns: repeat(4, minmax(128px, 1fr));\n  gap: 10px;\n}`;
const after = `.image-grid {\n  display: grid;\n  grid-template-columns: repeat(4, minmax(128px, 1fr));\n  gap: 10px;\n  flex: 0 0 auto;\n}`;

if (source.includes(after)) {
  console.log("V2 image panel scroll fix already integrated");
  process.exit(0);
}
if (!source.includes(before)) {
  throw new Error("image panel scroll patch anchor missing");
}
source = source.replace(before, after);
fs.writeFileSync(filePath, source, "utf8");
console.log("V2 image panel scroll fix applied");
