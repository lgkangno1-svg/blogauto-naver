const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");
const {
  buildJobTokenDiagnostics,
  historyTokenFields,
  summarizeHistoryTokenDiagnostics
} = require("../src/lib/jobDiagnostics");

const root = path.resolve(__dirname, "..");
const diagnostics = buildJobTokenDiagnostics({
  total: 1000,
  grossTotal: 1600,
  agents: { research: 300, writer: 500, main: 200 },
  grossAgents: { research: 450, writer: 850, main: 300 }
});
const fields = historyTokenFields({ diagnostics });
assert.equal(fields.token_total, 1000);
assert.equal(fields.token_gross_total, 1600);
assert.equal(fields.token_saved, 600);
assert.equal(fields.token_savings_percent, 37.5);
assert.equal(fields.token_largest_agent, "writer");
assert.equal(fields.token_agents.writer, 500);

const history = [
  { blog_id: "a", token_total: 1800, token_gross_total: 2400, token_saved: 600, token_agents: { writer: 900, research: 500 } },
  { blog_id: "a", token_total: 1000, token_gross_total: 1500, token_saved: 500, token_agents: { writer: 500, research: 300 } },
  { blog_id: "a", token_total: 1000, token_gross_total: 1500, token_saved: 500, token_agents: { writer: 500, research: 300 } },
  { blog_id: "a", token_total: 1000, token_gross_total: 1500, token_saved: 500, token_agents: { writer: 500, research: 300 } },
  { blog_id: "b", token_total: 9999, token_gross_total: 9999, token_saved: 0, token_agents: { main: 9999 } }
];
const summary = summarizeHistoryTokenDiagnostics(history, { blogId: "a", limit: 20 });
assert.equal(summary.sampleCount, 4);
assert.equal(summary.averageTotal, 1200);
assert.equal(summary.medianTotal, 1000);
assert.equal(summary.largestAgent, "writer");
assert.equal(summary.latestVsPreviousPercent, 80);
assert.equal(summary.anomaly, true);

const mainSource = fs.readFileSync(path.join(root, "src", "main.js"), "utf8");
const appSource = fs.readFileSync(path.join(root, "src", "renderer", "app.js"), "utf8");
const htmlSource = fs.readFileSync(path.join(root, "src", "renderer", "index.html"), "utf8");
assert(mainSource.includes("historyTokenFields"));
assert(mainSource.includes("...historyTokenFields(jobTokenUsage)"));
assert(appSource.includes("function renderTokenHistoryBaseline"));
assert(appSource.includes("renderTokenHistoryBaseline(items)"));
assert(htmlSource.includes('id="tokenHistoryBaseline"'));

console.log("V2 durable history token diagnostics checks passed");
