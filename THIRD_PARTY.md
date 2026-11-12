# Third-party assets

| Asset | Version | Licence | Upstream |
|---|---|---|---|
| three.js | 0.163.0 | MIT | https://github.com/mrdoob/three.js |
| Orbitron | v31 (Google Fonts) | SIL Open Font License 1.1 | https://fonts.google.com/specimen/Orbitron |
| Rajdhani | v17 (Google Fonts) | SIL Open Font License 1.1 | https://fonts.google.com/specimen/Rajdhani |

Orbitron and Rajdhani are currently loaded from `fonts.googleapis.com`; the
game's CSS falls back to a local sans-serif stack if they fail. `node
tools/vendor.mjs` downloads local copies (with `three.LICENSE`) into `vendor/`
for offline use.
