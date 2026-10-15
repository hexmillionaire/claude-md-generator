# claude-md-generator

**Scan any repo and draft a `CLAUDE.md` your AI coding agent can actually use.**

```bash
npx claude-md-generator
```

That's it. It reads your `package.json` (or `pyproject.toml`, `go.mod`, `Cargo.toml`), lockfile, folder layout, `.env.example`, CI config and existing docs, then writes a `CLAUDE.md` with the boring half already filled in and the important half scaffolded for you.

Zero dependencies. Nothing leaves your machine. Works for Claude Code, Cursor, Codex, Copilot — anything that reads `CLAUDE.md` or `AGENTS.md`.

---

## What you get

A file with two kinds of content:

**Filled in from the repo**

- Stack: language, package manager, framework + version, backend, auth, ORM, payments, styling, state, AI SDKs, web3, and ~80 other libraries it recognises
- Commands: every script, in sensible order, with the right `npm run` / `pnpm` / `make` prefix, plus a "before saying done" check chain
- Layout: each top-level folder with what it's for, and your route list if it's an App Router app
- Environment variables: from `.env.example` *and* from `process.env.X` / `os.environ[...]` in your code, flagged public vs server-only, with the ones you forgot to document called out
- Conventions it can see: TS strict, path aliases, ESLint/Prettier/Biome, git hooks, shadcn style, ESM
- Stack-specific gotchas: Prisma migrations, Stripe raw-body webhooks, Convex generated files, Next.js 16 changes, Expo bundle ids
- CI and deploy config present

**Left for you, with prompts that make them easy to answer**

- **Invariants that are easy to break** — the rules that don't fail loudly, they ship broken. This is the section that saves you afternoons. The generator seeds a few from your stack; the real ones come from your last three "how did that reach production" bugs.
- **Where things go** — the three changes you make most often and the files they touch.

Search the output for `TODO`. Usually there are four or five.

---

## Usage

```bash
npx claude-md-generator            # writes ./CLAUDE.md
npx claude-md-generator ./apps/web # a different directory
npx claude-md-generator --print    # stdout only, writes nothing
npx claude-md-generator --agents   # also writes AGENTS.md pointing at CLAUDE.md
npx claude-md-generator --force    # overwrite an existing CLAUDE.md
npx claude-md-generator --out docs/AGENT.md
npx claude-md-generator --json     # dump the scan (to see what it detected)
```

If `CLAUDE.md` already exists it will not be touched: the draft goes to `CLAUDE.generated.md` so you can merge by hand.

Requires Node 18+.

---

## Why

Agents read `CLAUDE.md` at the start of every session. A good one is the difference between "add a notes table" producing the right files on the first try and producing a plausible-looking wrong guess. Most people either don't write one, or write a paragraph of vibes.

The facts — stack, commands, layout, env — take twenty minutes to type and are the same twenty minutes for every project. The generator does those. What's left is the part only you know, and the file is structured so you know exactly what to put there.

The output is deliberately short. Agents read the whole file every session; a 600-line `CLAUDE.md` costs you context on every prompt and gets skimmed.

---

## Example output

Run on a Next.js + Convex + Clerk app:

```markdown
# convex-clerk-starter — agent notes

Vibe Stack — Next.js + Convex + Clerk starter for people who build with AI.

## Stack

- TypeScript · npm
- Next.js 16.2.1
- Routing: App Router
- Backend: Convex 1.34.0
- Auth: Clerk 7.0.7
- Styling: Tailwind CSS v4
- UI: shadcn/ui 4.1.0, Base UI 1.3.0, Lucide icons 0.577.0, next-themes 0.4.6
- Integration: Convex ↔ Clerk

> **Next.js 16.2.1 is newer than most training data.** Conventions differ
> (`proxy.ts` replaces `middleware.ts` in 16, async `params`/`searchParams`, Turbopack by default).
> Read `node_modules/next/dist/docs/` for the relevant API before writing framework code.

Things about this stack that are easy to get wrong:

- **Convex:** Regenerates `convex/_generated/` while `npx convex dev` runs — never hand-edit those.
- **Convex ↔ Clerk:** the Clerk JWT template must be named `convex` and its issuer set with
  `npx convex env set CLERK_JWT_ISSUER_DOMAIN`.

## Commands

| Command | What it does |
|---|---|
| `npm run dev` | Dev server |
| `npm run build` | Production build |
| `npm run typecheck` | Type-check only, no emit |
| `npm run lint` | Lint |

**Before saying "done":** `npm run typecheck` → `npm run lint` → `npm run build`.

## Environment variables

| Variable | Notes |
|---|---|
| `CLERK_SECRET_KEY` | Clerk Dashboard → your app → API Keys. — server-only; in `.env.example` |
| `NEXT_PUBLIC_CONVEX_URL` | Written automatically by `npx convex dev`. — public (shipped to the browser) |
| `OPENAI_API_KEY` | server-only; read in `src/app/api/explain-verse/route.ts` |

1 of these is read in code but missing from the example env file: `OPENAI_API_KEY`.

## Invariants that are easy to break

<!-- TODO: … -->

Starting points from the stack (verify, edit, or delete):

- Identity in Convex functions comes from `ctx.auth.getUserIdentity()`, never from a `userId` argument.
- Clerk hooks throw outside `<ClerkProvider>`. If the provider is conditional anywhere, every hook import must go through a wrapper.
- Setting `openGraph` in a page's `metadata` replaces, not merges, the parent's — so it drops the inherited image.

## Where things go

| Need | Do |
|---|---|
| A new page | `src/app/<route>/page.tsx`; a `layout.tsx` beside it for metadata |
| A new table | `convex/schema.ts` with an index for every way it's queried; functions in `convex/<table>.ts` |
| A reusable component | `src/components/<name>.tsx`; primitives from shadcn go in `src/components/ui/` via the CLI |
```

(Trimmed. The real file is ~110 lines.)

---

## What it detects

Languages: TypeScript, JavaScript, Python, Go, Rust.
Frameworks: Next.js, Nuxt, Remix, React Router, SvelteKit, Astro, Expo, React Native, Angular, Vue, Svelte, SolidJS, NestJS, Fastify, Hono, Express, Electron, Vite (+React/Vue/Svelte/Solid), FastAPI, Django, Flask, Streamlit.
Plus ~80 libraries across backend, auth, ORM, payments, styling, UI, state, data fetching, validation, AI, web3, email, jobs, analytics, monitoring, i18n, charts, testing.

Missing one you use? Open a PR adding a line to `STACK` in `src/scan.js`. It's a table.

---

## Related

- [convex-clerk-starter](https://github.com/hexmillionaire/convex-clerk-starter) — a Next.js + Convex + Clerk starter whose `CLAUDE.md` is the shape this tool produces, with the invariants filled in from production.

## License

MIT
