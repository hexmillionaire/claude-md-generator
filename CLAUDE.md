# claude-md-generator — agent notes

Scan any repo and draft a CLAUDE.md your AI coding agent can actually use — stack, commands, layout, env vars, and a scaffold for the invariants only you know.

Read this file before changing anything. It's short. The sections marked
**Invariants** and **Where things go** matter more than the rest.

## Stack

- JavaScript · npm
- Tests: node --test or custom

## Commands

| Command | What it does |
|---|---|
| `npm test` | Run tests |
| `npm run try` | `node bin/claude-md.js --print` |

**Before saying "done":** `npm test`. Then open it in a browser or run it; types agreeing with each other is not the same as the thing working.

## Layout

| Path | What's there |
|---|---|
| `bin/` | executables (1 file) |
| `src/` | application source (3 files) |
| `test/` | tests (14 files) |

## Environment variables

| Variable | Notes |
|---|---|
| `DATABASE_URL` | server-only; read in `test/fixtures/python-fastapi/app/main.py` |
| `SENTRY_DSN` | server-only; read in `test/fixtures/vite-prisma-stripe/src/main.tsx` |
| `STRIPE_SECRET_KEY` | server-only; read in `test/fixtures/python-fastapi/app/main.py` |
| `VITE_STRIPE_PK` | public (shipped to the browser); read in `test/fixtures/vite-prisma-stripe/src/main.tsx` |

There is no `.env.example`. Create one listing the variables above (names only, no values) so a fresh clone fails at setup instead of at runtime.

Never commit real values. Public-prefixed vars are embedded in the client bundle; secrets must not have that prefix.

## Conventions

- Package is ESM (`"type": "module"`): use `import`, not `require`.
- <!-- TODO: naming, file organisation, error handling, anything a new contributor gets wrong in week one. -->

## Invariants that are easy to break

<!-- TODO: This is the most valuable section and only you can write it.
     An invariant is a rule that, when broken, doesn't fail loudly — it
     ships broken. Each one is a paragraph: the rule, what happens when
     it's violated, and where it lives. Good sources: your last three
     "how did that get to production" bugs. Examples of the shape:

     **The root provider must render on the server.** It was once wrapped
     in dynamic(..., { ssr: false }) and every page shipped an empty body.

     **Prices are integers in cents, everywhere.** A float got in once via
     a CSV import and rounding drifted the ledger by $0.01 per row.
-->

## Where things go

| Need | Do |
|---|---|
| A test | next to the file it tests, run with `node --test "test/**/*.test.js"` |
| <!-- TODO: the three changes you make most often --> | |

## CI and deploy

- `.github/workflows/ci.yml` — CI

## Also read

- `README.md`

---

*Drafted by [claude-md-generator](https://github.com/hexmillionaire/claude-md-generator). Facts above were read from the repo; TODO blocks are yours. Keep this file under ~150 lines — agents read all of it, every session.*
