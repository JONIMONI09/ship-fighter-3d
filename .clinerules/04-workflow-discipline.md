# Workflow Discipline — Todo lists, Subtasks, Token saving

Cline mechanisms used here (no external plugins needed for this):
Rules (`.clinerules/`, always active), Skills (`.cline/skills/`, on demand),
Plugins (`.cline/plugins/`, hooks/tools), `npm run brainstorm` (plan.md).

## Todo lists
- Any task with 3+ steps: FIRST print a short numbered todo checklist,
  then work through it. Re-print the checklist with `[x]`/`[ ]` after each
  completed step and at the end.
- One step per message result; do not silently batch unrelated edits.

## Subtasks / subagents
- Delegate isolated research, big-file summarization, or repeated greps to a
  subagent instead of re-reading large files in the main thread.
- Subagent prompt must state: goal, exact files, expected output (<= 30 lines).
- Never let a subagent edit files; it reports findings, the main thread edits.

## Token discipline
- Do not re-read files fully — use line ranges when the file is known.
- Batch independent reads/searches/commands into ONE parallel tool call.
- Prefer targeted `search_codebase` patterns over full-file reads.
- Keep `session.md` current so a fresh session resumes without replaying
  the whole chat history.

## Brainstorm / plan
- New feature ideas: `npm run brainstorm` (writes docs/plan.md), then pick
  ONE item per session and record the pick in session.md.

## FIX counter (critical)
- Before ANY new game-code fix: read the current FIX number in
  `.clinerules/01-coding-standards.md` and docs/LESSONS.md, use the next
  free number (never reuse), and update both counts in the same session.

## Plugin workflow (mandatory)
- Every plugin creation/fix follows the `plugin-forge` skill
  (`.cline/skills/plugin-forge/SKILL.md`) — gates: `node --check` →
  `node tools/plugin-selftest.mjs` → live file-trace for new plugins
  (trace removed afterwards). No "it works" claims without proof.
- After EVERY plugin task: spawn the `plugin-reviewer` subagent
  (`.cline/skills/plugin-reviewer/SKILL.md`) with main prompt + edits +
  proof, record VERDICT + improvements in session.md.
- **At the end of every session that touched (or should have touched)
  plugins, ALWAYS ask the user:**
  "Soll an einem bestehenden Plugin noch etwas verbessert werden?"
  — proactively propose up to 3 no-cost improvements (free endpoints,
  NO API keys). Never end silently.
- Free tooling rule: project plugins/skills must work WITHOUT API keys;
  free no-key endpoints (DuckDuckGo HTML, Wikipedia REST, npm registry,
  GitHub public search, open.er-api.com) are the default data sources.

