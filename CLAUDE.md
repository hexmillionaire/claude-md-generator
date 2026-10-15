# claude-md-generator — agent notes

Scans a repo and drafts a CLAUDE.md: facts filled in, invariants scaffolded. Zero dependencies, Node 18+, ESM.

## Stack

- JavaScript · npm · ESM
- Tests: `node --test`

## Commands

| Command | What it does |
|---|---|
| `npm test` | Run tests (Node 18/20/22 in CI) |
| `npm run try` | Run the generator on this repo, print to stdout |
| `node bin/claude-md.js <dir> --json` | Dump the scan result — the fastest way to see why something wasn't detected |

**Before saying "done":** `npm test`, then `npm run try` and read the output as a user would.

## Layout

| Path | What's there |
|---|---|
| `bin/claude-md.js` | Entry point; only calls `run()` |
| `src/cli.js` | Arg parsing, file writing, the clobber guard |
| `src/scan.js` | Everything that reads the repo. Pure: filesystem in, plain object out |
| `src/render.js` | Everything that writes markdown. Pure: plain object in, string out |
| `test/fixtures/` | One tiny fake repo per stack shape |

## Invariants that are easy to break

**Zero runtime dependencies.** `npx claude-md-generator` must install in under a second on a cold cache; that's the whole pitch. Node built-ins only. If a feature needs a package, it doesn't ship.

**`scan()` never executes anything.** No `child_process`, no `require()` of the target's files, no network. People run this on repos they don't trust yet. Read files, that's all.

**Never overwrite an existing `CLAUDE.md` without `--force`.** It's hand-written and the most valuable file in the target repo. The fallback is `CLAUDE.generated.md` beside it.

**The output stays under ~150 lines.** Agents read all of it every session. A detection that adds a paragraph to every project's file needs to earn it; prefer one line, and prefer nothing over a line that's usually wrong.

**Env grep skips test trees.** `test/`, `fixtures/`, `__mocks__` and friends hold env vars that belong to the tests, not the app. Listing them taught this repo's own CLAUDE.md that it needs a `DATABASE_URL`.

## Where things go

| Need | Do |
|---|---|
| Recognise a new library | One row in `STACK` in `src/scan.js`: `[npm name, display name, kind, gotcha-or-null]` |
| A new framework | `FRAMEWORKS` in `src/scan.js` (order matters: first match wins) |
| A stack-specific gotcha | The fourth column of `STACK`, or `seedInvariants()` in `src/render.js` for the invariants section |
| A new "where things go" row | `seedWhereThingsGo()` in `src/render.js`, gated on what was detected |
| A new language | A `scanX()` function in `src/scan.js` returning `{ stack, scripts, conventions, tests, framework }` |
| A new flag | `parseArgs()` in `src/cli.js`, then `HELP`, then a test in `test/cli.test.js` |

Every detection change gets a fixture change: fixtures are fake repos, so a new one is a few empty files and a `package.json`.

## Also read

- `README.md` — user-facing; keep the example output there in sync with real output
