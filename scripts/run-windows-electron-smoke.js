const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const sourcePath = path.join(__dirname, "smoke-electron.js");
const tempPath = path.join(__dirname, ".smoke-electron-windows-ci.js");

const beforeSetup = `    await window.evaluate(() => {\n      const grid = document.querySelector("#imageGrid");`;
const afterSetup = `    // The normal maximum image set can legitimately fit without overflow. For the\n    // scroll-capability assertion only, use the supported minimum window size and\n    // an intentionally oversized synthetic image set.\n    await window.setViewportSize({ width: 980, height: 720 });\n    await window.waitForTimeout(100);\n    await window.evaluate(() => {\n      const grid = document.querySelector("#imageGrid");`;
const beforeImageCount = "      for (let index = 1; index <= 12; index += 1) {";
const afterImageCount = "      for (let index = 1; index <= 48; index += 1) {";

const beforeAssertion = `    const imagePanelScrollable = await window.locator(".image-panel").evaluate((element) => (\n      element.scrollHeight > element.clientHeight\n    ));\n    if (!imagePanelScrollable) {\n      throw new Error("Image preview panel is not scrollable with many images.");\n    }`;
const afterAssertion = `    const imagePanelScrollState = await window.locator(".image-panel").evaluate((element) => {\n      const style = window.getComputedStyle(element);\n      const before = element.scrollTop;\n      element.scrollTop = Math.max(1, Math.min(80, element.scrollHeight - element.clientHeight));\n      const moved = element.scrollTop > before;\n      element.scrollTop = before;\n      return {\n        overflowY: style.overflowY,\n        hasOverflow: element.scrollHeight > element.clientHeight,\n        moved\n      };\n    });\n    if (!["auto", "scroll"].includes(imagePanelScrollState.overflowY) || !imagePanelScrollState.hasOverflow || !imagePanelScrollState.moved) {\n      throw new Error(\`Image preview panel cannot scroll under forced overflow: \${JSON.stringify(imagePanelScrollState)}\`);\n    }`;

// GitHub's Windows runner may check text files out with CRLF. Normalize only the
// temporary test copy so anchors and behavior remain platform-independent.
let source = fs.readFileSync(sourcePath, "utf8").replace(/\r\n/g, "\n");
for (const [needle, label] of [
  [beforeSetup, "image setup"],
  [beforeImageCount, "image count"],
  [beforeAssertion, "image scroll assertion"]
]) {
  if (!source.includes(needle)) throw new Error(`Windows smoke patch anchor missing: ${label}`);
}
source = source
  .replace(beforeSetup, afterSetup)
  .replace(beforeImageCount, afterImageCount)
  .replace(beforeAssertion, afterAssertion);
fs.writeFileSync(tempPath, source, "utf8");

try {
  const result = spawnSync(process.execPath, [tempPath], {
    cwd: path.resolve(__dirname, ".."),
    env: process.env,
    stdio: "inherit"
  });
  if (result.error) throw result.error;
  process.exitCode = Number.isInteger(result.status) ? result.status : 1;
} finally {
  try { fs.rmSync(tempPath, { force: true }); } catch {}
}
