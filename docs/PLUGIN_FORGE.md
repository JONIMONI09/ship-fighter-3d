# docs/PLUGIN_FORGE.md — Cline CLI plugins: pro guide, installer & lessons

Status: verified 2026-09-10, Cline CLI 3.0.61, Windows 11. Zero cost, zero
API keys. Related: `.cline/skills/plugin-forge/SKILL.md` (workflow),
`.cline/skills/plugin-reviewer/SKILL.md` (review), `tools/plugin-selftest.mjs`
(hook tests), `docs/LESSONS.md` § Session 3q.

## 1. What plugins are (and what they are NOT)

- Plugins = **hooks only**. Auto-discovered from `<project>/.cline/plugins/`
  (`.js`/`.ts` — `.cjs` is silently ignored, learned the hard way).
- They are NOT a prompt-injection mechanism: there is no `beforeAction`
  hook and no `context.injectSystemPrompt()` in the API. Always-active
  rules live in `.clinerules/`, on-demand instructions in
  `.cline/skills/<name>/SKILL.md` (with `name`/`description` frontmatter).
- Plugin `console.log`/`console.error` does **not** appear on the CLI
  stdout. Functional proof requires the selftest or a temporary file
  trace. Never trust "I saw nothing, so it did not fire" — reverse is
  true: output routing hides it.

## 2. Plugin shape (the only correct one)

```js
// .cline/plugins/<name>.js — ESM, default or named export
const plugin = {
  name: "<unique-name>",
  manifest: { capabilities: ["hooks"] },
  hooks: {
    beforeRun() { return undefined; },
    beforeTool({ toolCall, input }) {
      // guard: return { stop: true, reason: "why" } to block a tool call
      return undefined;
    },
    afterTool({ toolCall }) { return undefined; },
    afterRun({ result }) {
      // result.status, result.usage { inputTokens, outputTokens, totalCost }
      return undefined;
    },
  },
};
export { plugin };
export default plugin;
```

Guard contract: block = `{ stop: true, reason: string }`, pass = `undefined`.
Observational hooks always return `undefined`.

## 3. Installer (remote single-file plugins) — pro workflow

```powershell
# install (web or raw URL both work) — lands in
# .cline/plugins/_installed/remote/<name>-<hash>/<name>.ts
cline plugin install https://github.com/<org>/<repo>/blob/main/<plugin>.ts --cwd . --json

# search / list / uninstall
cline plugin search <term>
cline plugin list
cline plugin uninstall <install-path> --cwd . --json   # PATH, not short name!
```

- Quirk: `plugin uninstall <short-name>` can fail with
  "Multiple plugins match ..." (path matched twice) — always pass the
  install path.
- `cline config` is TTY-only; scripts use `--json` flags instead.
- Loose local files need NO installer; the installer is for remote
  single-file plugins (tested with the official `weather-metrics.ts`).

## 4. Testing gates (in order, all mandatory)

1. `node --check .cline/plugins/<name>.js`
2. `node tools/plugin-selftest.mjs` (extend per new hook behavior — in the
   SAME edit as the plugin change, false-negative lesson)
3. Live proof for NEW plugins: temporary file trace
   (`appendFileSync` into the plugin, run one CLI session, read the log,
   delete the trace). Pure guards may skip the trace if selftest covers them.
4. `plugin-reviewer` subagent with main prompt + edits + proof excerpt.

## 5. Free, NO-API-KEY data sources (erprobt 2026-09-10)

| Endpoint | Cost | Auth | Use for |
|---|---|---|---|
| `https://html.duckduckgo.com/html/?q=<query>` | free | none | web search |
| `https://de.wikipedia.org/api/rest_v1/page/summary/<title>` | free | none | topic summaries |
| `https://registry.npmjs.org/<package>` | free | none | package info |
| `https://api.github.com/search/code?q=` | free | none (rate-limited) | public code search |
| `https://open.er-api.com/v6/latest/USD` | free | none | FX rates |

Verified with a live fetch in session 3q: Wikipedia REST works with zero
keys; DuckDuckGo HTML was flaky from this network (socket closed) — always
implement a fallback chain (Wikipedia → npm registry → open.er-api), never
rely on a single endpoint.
Plugins must work without keys — if an endpoint needs auth, it violates
the free-tooling rule in `.clinerules/04`.

## 6. Problems learned (never repeat)

1. `.cjs` extension → not discovered (only `.js`/`.ts` are scanned).
2. Invented `beforeAction` hook / `context.injectSystemPrompt()` → do not
   exist; caused the original "Plugins (0)" confusion.
3. `SKILL.md` at project root → ignored; skills need
   `.cline/skills/<name>/SKILL.md` + frontmatter.
4. Plugin output invisible on stdout → prove with file trace/selftest.
5. Uninstall by short name → dup-match error; use install path.
6. PowerShell stderr lines from guards → harnesses show them as
   NativeCommandError; selftest captures `console.error` instead.
7. Parallel command + existence-check races (trace file read too early) →
   read proof files in a SEPARATE turn after the run finished.

## 7. End-of-task discipline (mandatory)

- Spawn `plugin-reviewer` (skeptical subagent) — verdict recorded in
  session.md.
- **ALWAYS end with the improvement question:**
  "Soll an einem bestehenden Plugin noch etwas verbessert werden?"
  Propose up to 3 concrete no-cost improvements (no API keys, free
  endpoints only). Never finish silently.
- Transient CLI/model errors ("Model returned empty response"): retry the
  turn once, keep prompts small; it is a provider-side hiccup, not a
  plugin bug — never build retry-loops into project code for it.

