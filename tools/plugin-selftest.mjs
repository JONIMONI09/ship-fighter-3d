// plugin-selftest.mjs — offline sanity check for the Cline CLI plugin in
// .cline/plugins/smart-context.js. No live session, no API cost: imports the
// plugin module and exercises every hook with fake contexts.
// Run: node tools/plugin-selftest.mjs   (exit 1 on any failure)

import { readFileSync } from "node:fs";

const mod = await import(
  new URL("../.cline/plugins/smart-context.js", import.meta.url).href
);
const plugin = mod.default ?? mod.plugin;

let failures = 0;
const check = (label, cond) => {
  console.log(`${cond ? "PASS" : "FAIL"}  ${label}`);
  if (!cond) failures += 1;
};

// Capture stderr (console.error) so PowerShell harnesses do not mistake the
// plugin's guard output for a process error — and so we can verify the text.
const stderrLines = [];
const realConsoleError = console.error;
console.error = (...args) => {
  stderrLines.push(args.map(String).join(" "));
};

// Export shape (what the CLI host expects: default or named AgentPlugin export)
check("plugin object with name 'smart-context-agent'",
  plugin && typeof plugin === "object" && plugin.name === "smart-context-agent");
check("manifest declares capabilities ['hooks']",
  Array.isArray(plugin.manifest?.capabilities) &&
    plugin.manifest.capabilities.includes("hooks"));
check("hooks object present", plugin.hooks && typeof plugin.hooks === "object");

const hooks = plugin.hooks;

// beforeRun: observational, must return undefined
check("beforeRun returns undefined", hooks.beforeRun() === undefined);

// beforeTool: benign commands pass through untouched
check("benign run_commands not blocked",
  hooks.beforeTool({ toolCall: { toolName: "run_commands" },
    input: { commands: ["echo hi"] } }) === undefined);

// beforeTool: the LESSONS.md tool-safety guard must block these
const traceFile = new URL("../.cline/plugins/compactor-trace.jsonl", import.meta.url);
const traceCount = () => {
  try {
    return readFileSync(traceFile, "utf8").trim().split("\n").filter(Boolean).length;
  } catch {
    return 0;
  }
};

const blocked = hooks.beforeTool({ toolCall: { toolName: "run_commands" },
  input: { commands: ["taskkill /F /IM node.exe"] } });
check("blocks 'taskkill /F /IM node.exe'",
  Boolean(blocked?.stop) && typeof blocked.reason === "string");
// v2 compactor: the blocked call MUST land in the trace file (ok:false) —
// nothing skipped, failures included.
check("blocked call traced to compactor-trace.jsonl (ok:false)",
  readFileSync(traceFile, "utf8").includes("BLOCKED") &&
    readFileSync(traceFile, "utf8").includes("node.exe"));

// compactor: EVERY afterTool call gets traced — failure included, none skipped
const beforeN = traceCount();
hooks.afterTool({ toolCall: { toolName: "editor" }, error: new Error("boom") });
hooks.afterTool({ toolCall: { toolName: "editor" }, result: "fine" });
const afterLines = readFileSync(traceFile, "utf8").trim().split("\n").slice(beforeN);
check("afterTool traces failure AND success (nothing skipped)",
  afterLines.length === 2 &&
    afterLines.every((l) => l.includes("\"ev\":\"tool\"")) &&
    afterLines.some((l) => l.includes("\"ok\":false")) &&
    afterLines.some((l) => l.includes("\"ok\":true")));

check("blocks case/format variants ('TASKKILL /f /im NODE.EXE')",
  hooks.beforeTool({ toolCall: { toolName: "run_commands" },
    input: { commands: ["TASKKILL /f /im NODE.EXE"] } })?.stop === true);

check("blocks 'taskkill /IM cline'",
  hooks.beforeTool({ toolCall: { toolName: "run_commands" },
    input: { commands: ["taskkill /IM cline"] } })?.stop === true);

check("non-run_commands tools untouched",
  hooks.beforeTool({ toolCall: { toolName: "editor" }, input: {} }) === undefined);

check("missing input does not throw",
  hooks.beforeTool({ toolCall: { toolName: "run_commands" } }) === undefined);

// afterTool / afterRun: observational, tolerate minimal/absent payloads
check("afterTool returns undefined",
  hooks.afterTool({ toolCall: { toolName: "editor" } }) === undefined);
check("afterRun without usage returns undefined",
  hooks.afterRun({ result: { status: "completed" } }) === undefined);
check("afterRun with usage returns undefined",
  hooks.afterRun({ result: { status: "completed",
    usage: { inputTokens: 10, outputTokens: 5, totalCost: 0.123456 } } }) === undefined);
check("afterRun with empty context returns undefined",
  hooks.afterRun({}) === undefined);

console.error = realConsoleError;

console.log(failures === 0 ? "\nPLUGIN SELFTEST: ALL PASS"
  : `\nPLUGIN SELFTEST: ${failures} FAILURE(S)`);
process.exit(failures === 0 ? 0 : 1);
