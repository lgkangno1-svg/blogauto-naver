const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");
const { buildJobTokenDiagnostics } = require("../src/lib/jobDiagnostics");

const root = path.resolve(__dirname, "..");

const diagnostics = buildJobTokenDiagnostics({
  total: 1000,
  grossTotal: 1600,
  cachedInputTokens: 500,
  agents: { research: 300, writer: 500, main: 150, image: 50 },
  grossAgents: { research: 450, writer: 800, main: 250, image: 100 }
});

assert.equal(diagnostics.total, 1000);
assert.equal(diagnostics.grossTotal, 1600);
assert.equal(diagnostics.savedTokens, 600);
assert.equal(diagnostics.savingsPercent, 37.5);
assert.equal(diagnostics.largestAgent.agent, "writer");
assert.equal(diagnostics.largestAgent.sharePercent, 50);
assert.equal(diagnostics.agentRows.find((row) => row.agent === "research").saved, 150);

const fallback = buildJobTokenDiagnostics({
  agents: { research: 120, writer: 280 },
  grossAgents: { research: 150, writer: 350 }
});
assert.equal(fallback.total, 400);
assert.equal(fallback.grossTotal, 500);
assert.equal(fallback.savedTokens, 100);

const mainSource = fs.readFileSync(path.join(root, "src", "main.js"), "utf8");
const appSource = fs.readFileSync(path.join(root, "src", "renderer", "app.js"), "utf8");
const htmlSource = fs.readFileSync(path.join(root, "src", "renderer", "index.html"), "utf8");

assert(mainSource.includes('buildJobTokenDiagnostics'));
assert(mainSource.includes('jobTokenUsage.agents'));
assert(mainSource.includes('jobTokenUsage.grossAgents'));
assert(mainSource.includes('diagnostics: jobTokenUsage.diagnostics'));
assert(appSource.includes('function renderJobDiagnostics'));
assert(appSource.includes('renderJobDiagnostics(payload)'));
assert(htmlSource.includes('id="tokenDiagnosticsSummary"'));
assert(htmlSource.includes('id="agentTokenBreakdown"'));

console.log("V2 job diagnostics checks passed");
