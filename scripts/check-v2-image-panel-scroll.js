const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const css = fs.readFileSync(path.join(__dirname, "..", "src", "renderer", "styles.css"), "utf8");
const match = css.match(/\.image-grid\s*\{([\s\S]*?)\}/);
assert(match, "image-grid CSS block missing");
assert(/display:\s*grid\s*;/.test(match[1]), "image-grid must remain grid");
assert(/flex:\s*0\s+0\s+auto\s*;/.test(match[1]), "image-grid must not shrink inside image panel");
assert(/\.image-panel\s*\{[\s\S]*?overflow:\s*auto\s*;[\s\S]*?\}/.test(css), "image-panel must remain scrollable");
console.log("V2 image panel scroll checks passed");
