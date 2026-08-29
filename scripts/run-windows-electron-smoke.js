const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const sourcePath = path.join(__dirname, "smoke-electron.js");
const tempPath = path.join(__dirname, ".smoke-electron-windows-ci.js");

const beforeSetup = `    await window.evaluate(() => {\n      const grid = document.querySelector("#imageGrid");`;
const afterSetup = `    // The app's default 1440x920 window can legitimately fit the maximum practical\n    // image set without overflow. Verify scroll behavior at the supported minimum\n    // window size instead, where overflow must occur.\n    await window.setViewportSize({ width: 980, height: 720 });\n    await window.waitForTimeout(100);\n    await window.evaluate(() => {\n      const grid = document.querySelector("#imageGrid");`;

const beforeAssertion = `    const imagePanelScrollable = await window.locator(".image-panel").evaluate((element) => (\n      element.scrollHeight > element.clientHeight\n    ));\n    if (!imagePanelScrollable) {\n      throw new Error("Image preview panel is not scrollable with many images.");\n    }`;
const afterAssertion = `    const imagePanelScrollState = await window.locator(".image-panel").evaluate((element) => {\n      const style = window.getComputedStyle(element);\n      return {\n        overflowY: style.overflowY,\n        hasOverflow: element.scrollHeight > element.clientHeight\n      };\n    });\n    if (!["auto", "scroll"].includes(imagePanelScrollState.overflowY) || !imagePanelScrollState.hasOverflow) {\n      throw new Error(\`Image preview panel cannot scroll at minimum window size: \${JSON.stringify(imagePanelScrollState)}\`);\n    }`;

let source = fs.readFileSync(sourcePath, "utf8");
if (!source.includes(beforeSetup)) {
  throw new Error("Windows smoke patch anchor missing: image setup");
}
if (!source.includes(beforeAssertion)) {
  throw new Error("Windows smoke patch anchor missing: image scroll assertion");
}
source = source.replace(beforeSetup, afterSetup).replace(beforeAssertion, afterAssertion);
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
