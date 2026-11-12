---
name: plugin-forge
description: >
  How to create, install, test and improve Cline CLI plugins (AgentPlugin,
  hooks). Use when the user asks for a new plugin, a plugin fix, or whenever
  .cline/plugins/ files are created or edited. Encodes every problem already
  solved (discovery, .cjs trap, output routing, uninstall quirk) so they are
  never repeated. ALWAYS follow this skill, then run the plugin-reviewer
  skill at the end and ask the plugin-improvement question.
---

# plugin-forge — create Cline CLI plugins correctly (pro workflow)

## Hard facts (verified 2026-09-10, CLI 3.0.61 — do NOT re-litigate)

1. **Loose project plugins are auto-discovered** from
   `<project>/.cline/plugins/<name>.js` (or `.ts`). No `plugin install`
   needed for local files. Files with `.cjs` are IGNORED — never use that
   extension.
2. **Plugin shape:** default or named export of an object:
   `{ name, manifest: { capabilities: ["hooks"] }, hooks: { beforeRun,
   beforeTool, afterTool, afterRun } }`.
3. **Hook contracts:**
   - `beforeRun()` — run start. Return `undefined`.
   - `beforeTool({ toolCall, input })` — guard hooks return
     `{ stop: true, reason: string }` to block, else `undefined`.
   - `afterTool({ toolCall })` — observational.
   - `afterRun({ result })` — read `result.status` and `result.usage`
     (`inputTokens`, `outputTokens`, `totalCost`).
   - There is NO `beforeAction` hook and NO `context.injectSystemPrompt()`
     in the API — prompt injection is NOT a plugin job (that is what
     `.clinerules/` and skills are for).
4. **Plugin console output does NOT reach the CLI stdout.** Prove hook
   firings with a temporary file trace (append to a log file) or use
   `tools/plugin-selftest.mjs`. Never claim "it works" without one of those.
5. **Installer (for remote single-file plugins):**
   - Install: `cline plugin install <raw-url-or-web-url> --cwd . --json`
     → lands in `.cline/plugins/_installed/remote/<name>-<hash>/`.
   - List/search: `cline plugin list` / `cline plugin search <term>`.
   - Uninstall: pass the **install path**; uninstalling by short name can
     fail with "Multiple plugins match" (dup-match quirk).
   - TTY rule: `cline config` requires a TTY; use `--json` where possible.
6. **Testing (mandatory gates for plugin work):**
   - `node --check <plugin.js>` (syntax),
   - `node tools/plugin-selftest.mjs` (hook behavior),
   - one live CLI session with temporary file trace (or selftest if the
     plugin is a pure guard). Remove the trace afterwards.
7. **Free/no-API-key plugins** (erprobt, encode in plugin docs): plugins
   are local-only — free remote data for skills/agents via no-key endpoints:
   DuckDuckGo HTML (`https://html.duckduckgo.com/html/?q=`), Wikipedia REST,
   npm registry, GitHub public search, open.er-api.com FX rates. Never
   require an API key for project tooling.

## Correct file layout

```
.cline/plugins/smart-context.js      # loose local plugin (auto-discovered)
.cline/plugins/_installed/remote/    # installer target (managed by CLI)
.cline/skills/plugin-forge/SKILL.md  # this skill
.cline/skills/plugin-reviewer/SKILL.md
tools/plugin-selftest.mjs            # offline hook tests
docs/PLUGIN_FORGE.md                 # full guide + lessons
```

## Steps (every plugin task)

1. Read `docs/PLUGIN_FORGE.md` + existing plugins first (never invent hooks).
2. Write the plugin as `.js` ESM, export shape per hard fact 2. Constants
   at top, `console.error` for guard blocks, `console.log` otherwise.
3. Extend `tools/plugin-selftest.mjs` with a check per new hook behavior
   (extend the import/expectations in the SAME edit).
4. Gates: `node --check` → `node tools/plugin-selftest.mjs` → live trace
   (new plugins only) → remove trace.
5. Document: plugin header comment + `docs/PLUGIN_FORGE.md` (problems
   learned) + `session.md` entry.
6. **Finish with the plugin-reviewer skill (subagent), then ALWAYS ask:**
   "Soll an einem bestehenden Plugin noch etwas verbessert werden?"
   (mandatory improvement question — see .clinerules/04-workflow-discipline).
