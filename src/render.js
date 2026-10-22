/**
 * Turns a scan result into CLAUDE.md. The output has two kinds of content:
 * facts the scanner is sure of (filled in), and the things only the author
 * knows (left as short TODO blocks with a prompt that makes them easy to
 * answer). The TODOs are the point; the facts are there so the author
 * doesn't have to type the boring half.
 */
import { cell, flat } from "./text.js";

export function render(r) {
  const out = [];
  const push = (...lines) => out.push(...lines);
  const code = (s) => `\`${flat(s, 120)}\``;
  const pm = r.packageManager ?? "npm";
  const runCmd = (script) => {
    if (r.language === "Go" || r.language === "Rust" || r.language === "Python") return r.scripts[script];
    if (pm === "npm") return script === "test" || script === "start" ? `npm ${script}` : `npm run ${script}`;
    return `${pm} ${script}`;
  };

  // ── Header ─────────────────────────────────────────────────────────────
  push(`# ${flat(r.name, 120)} — agent notes`, ``);
  push(
    r.description
      ? `${flat(r.description, 300).replace(/\.?$/, ".")}`
      : `<!-- TODO: one sentence on what this app does and who it's for. -->`
  );
  push(``);
  push(
    `Read this file before changing anything. It's short. The sections marked`,
    `**Invariants** and **Where things go** matter more than the rest.`,
    ``
  );

  // ── Stack ──────────────────────────────────────────────────────────────
  push(`## Stack`, ``);
  const stackLines = [];
  if (r.language) stackLines.push(`- ${r.language}${r.packageManager ? ` · ${r.packageManager}` : ""}`);
  if (r.framework) stackLines.push(`- ${r.framework.name}${r.framework.version ? ` ${r.framework.version}` : ""}`);
  if (r.monorepo) stackLines.push(`- Monorepo: ${r.monorepo.tool}${r.monorepo.packages?.length ? ` (${r.monorepo.packages.join(", ")})` : ""}`);
  const byKind = groupBy(r.stack, (s) => s.kind);
  const kindLabel = {
    routing: "Routing", backend: "Backend", db: "Database", orm: "ORM", auth: "Auth", payments: "Payments",
    styling: "Styling", ui: "UI", state: "State", data: "Data fetching", api: "API", validation: "Validation",
    forms: "Forms", ai: "AI", web3: "Web3", email: "Email", jobs: "Jobs", notifications: "Notifications",
    realtime: "Realtime", analytics: "Analytics", monitoring: "Monitoring", i18n: "i18n", charts: "Charts",
    "3d": "3D", browser: "Browser automation", images: "Images", integration: "Integration", http: "HTTP",
    ml: "ML",
  };
  for (const [kind, items] of byKind) {
    stackLines.push(`- ${kindLabel[kind] ?? kind}: ${items.map((s) => s.name + (s.version && s.kind !== "routing" ? ` ${s.version}` : "")).join(", ")}`);
  }
  if (r.tests) stackLines.push(`- Tests: ${r.tests.runner}`);
  if (!stackLines.length) stackLines.push(`<!-- TODO: list the stack; nothing was detected automatically. -->`);
  push(...stackLines, ``);

  // Framework-specific heads-up.
  if (r.framework?.name === "Next.js" && r.framework.major >= 15) {
    push(
      `> **Next.js ${r.framework.version} is newer than most training data.** Conventions differ`,
      `> (\`proxy.ts\` replaces \`middleware.ts\` in 16, async \`params\`/\`searchParams\`, Turbopack by default).`,
      `> Read \`node_modules/next/dist/docs/\` for the relevant API before writing framework code.`,
      ``
    );
  }
  if (r.framework?.name === "Expo") {
    push(
      `> Expo project. Native changes need a new dev build (\`eas build --profile development\`); JS-only`,
      `> changes hot-reload. Check \`app.json\`/\`app.config.*\` before touching bundle ids or plugins.`,
      ``
    );
  }

  const notes = r.stack.filter((s) => s.note);
  if (notes.length) {
    push(`Things about this stack that are easy to get wrong:`, ``);
    for (const s of notes) push(`- **${s.name}:** ${s.note}`);
    push(``);
  }

  // ── Commands ───────────────────────────────────────────────────────────
  push(`## Commands`, ``);
  const scripts = Object.entries(r.scripts ?? {});
  if (scripts.length) {
    const PRIORITY = ["dev", "dev:all", "start", "build", "test", "test:watch", "typecheck", "type-check", "lint", "format", "check", "setup", "db:push", "db:migrate", "migrate", "generate", "deploy"];
    const ordered = [
      ...PRIORITY.filter((k) => r.scripts[k] !== undefined).map((k) => [k, r.scripts[k]]),
      ...scripts.filter(([k]) => !PRIORITY.includes(k)),
    ].slice(0, 16);
    push(`| Command | What it does |`, `|---|---|`);
    for (const [k, v] of ordered) {
      push(`| \`${cell(runCmd(k), 120)}\` | ${describeScript(k, v)} |`);
    }
    push(``);
    const checks = ["typecheck", "type-check", "lint", "test", "build"].filter((k) => r.scripts[k] !== undefined);
    if (checks.length) {
      push(`**Before saying "done":** ${checks.map((k) => code(runCmd(k))).join(" → ")}. Then open it in a browser or run it; types agreeing with each other is not the same as the thing working.`, ``);
    }
  } else {
    push(`<!-- TODO: how to run, build and test this. -->`, ``);
  }

  // ── Layout ─────────────────────────────────────────────────────────────
  push(`## Layout`, ``);
  if (r.layout.length) {
    push(`| Path | What's there |`, `|---|---|`);
    for (const row of r.layout) {
      push(`| ${code(row.path + "/")} | ${row.desc ?? `<!-- TODO: what lives here -->`}${row.files ? ` (${row.files} ${row.files === 1 ? "file" : "files"})` : ""} |`);
      for (const c of row.children ?? []) {
        if (!c.files || !c.desc) continue;
        push(`| ${code(c.path + "/")} | ${c.desc} |`);
      }
    }
    push(``);
    const routesRow = r.layout.find((row) => row.routes?.length);
    if (routesRow) {
      push(`Routes: ${routesRow.routes.map(code).join(", ")}.`, ``);
    }
  } else {
    push(`<!-- TODO: describe the folder layout. -->`, ``);
  }

  // ── Env ────────────────────────────────────────────────────────────────
  push(`## Environment variables`, ``);
  if (r.env.length) {
    const fromExample = r.env.filter((e) => e.sources.some((s) => s.startsWith(".env")));
    const onlyInCode = r.env.filter((e) => !e.sources.some((s) => s.startsWith(".env")));
    push(`| Variable | Notes |`, `|---|---|`);
    for (const e of r.env) {
      const where = e.sources.find((s) => s.startsWith(".env")) ?? `read in ${code(e.sources[0])}`;
      const vis = e.public ? "public (shipped to the browser)" : "server-only";
      push(`| ${code(e.name)} | ${e.comment ? cell(e.comment, 160) + " — " : ""}${vis}; ${where.startsWith("read") ? where : `in ${code(where)}`} |`);
    }
    push(``);
    if (onlyInCode.length && fromExample.length) {
      push(`${onlyInCode.length} of these are read in code but missing from the example env file — add them so the next clone doesn't guess: ${onlyInCode.map((e) => code(e.name)).join(", ")}.`, ``);
    } else if (!fromExample.length) {
      push(`There is no \`.env.example\`. Create one listing the variables above (names only, no values) so a fresh clone fails at setup instead of at runtime.`, ``);
    }
    push(`Never commit real values. Public-prefixed vars are embedded in the client bundle; secrets must not have that prefix.`, ``);
  } else {
    push(`None detected. <!-- TODO: if the app needs keys, list them and where they come from. -->`, ``);
  }

  // ── Conventions ────────────────────────────────────────────────────────
  push(`## Conventions`, ``);
  if (r.conventions.length) for (const c of r.conventions) push(`- ${c}`);
  push(`- <!-- TODO: naming, file organisation, error handling, anything a new contributor gets wrong in week one. -->`);
  push(``);

  // ── Invariants ─────────────────────────────────────────────────────────
  push(`## Invariants that are easy to break`, ``);
  push(
    `<!-- TODO: This is the most valuable section and only you can write it.`,
    `     An invariant is a rule that, when broken, doesn't fail loudly — it`,
    `     ships broken. Each one is a paragraph: the rule, what happens when`,
    `     it's violated, and where it lives. Good sources: your last three`,
    `     "how did that get to production" bugs. Examples of the shape:`,
    ``,
    `     **The root provider must render on the server.** It was once wrapped`,
    `     in dynamic(..., { ssr: false }) and every page shipped an empty body.`,
    ``,
    `     **Prices are integers in cents, everywhere.** A float got in once via`,
    `     a CSV import and rounding drifted the ledger by $0.01 per row.`,
    `-->`,
    ``
  );
  // Seed a couple from the stack when we're confident.
  const seeded = seedInvariants(r);
  if (seeded.length) {
    push(`Starting points from the stack (verify, edit, or delete):`, ``);
    for (const s of seeded) push(`- ${s}`);
    push(``);
  }

  // ── Where things go ────────────────────────────────────────────────────
  push(`## Where things go`, ``);
  push(`| Need | Do |`, `|---|---|`);
  for (const [need, where] of seedWhereThingsGo(r)) push(`| ${need} | ${where} |`);
  push(`| <!-- TODO: the three changes you make most often --> | |`);
  push(``);

  // ── CI / deploy ────────────────────────────────────────────────────────
  if (r.ci.length) {
    push(`## CI and deploy`, ``);
    for (const c of r.ci) push(`- ${code(c.file)} — ${c.name}`);
    push(``);
  }

  // ── Docs ───────────────────────────────────────────────────────────────
  const otherDocs = r.docs.filter((d) => d !== "CLAUDE.md");
  if (otherDocs.length) {
    push(`## Also read`, ``);
    for (const d of otherDocs) push(`- ${code(d)}`);
    push(``);
  }

  // ── Footer ─────────────────────────────────────────────────────────────
  push(`---`, ``);
  push(`*Drafted by [claude-md-generator](https://github.com/hexmillionaire/claude-md-generator). Facts above were read from the repo; TODO blocks are yours. Keep this file under ~150 lines — agents read all of it, every session.*`, ``);

  return out.join("\n");
}

function groupBy(arr, fn) {
  const m = new Map();
  for (const x of arr) {
    const k = fn(x);
    if (!m.has(k)) m.set(k, []);
    m.get(k).push(x);
  }
  return m;
}

function describeScript(name, cmd) {
  const c = flat(cmd, 400);
  const known = {
    dev: "Dev server",
    "dev:all": "Dev server plus backend watcher",
    start: "Run the production build",
    build: "Production build",
    test: "Run tests",
    "test:watch": "Tests in watch mode",
    typecheck: "Type-check only, no emit",
    "type-check": "Type-check only, no emit",
    lint: "Lint",
    format: "Format",
    check: "All static checks",
    setup: "First-run setup",
    deploy: "Deploy",
    preview: "Preview the production build locally",
    clean: "Remove build output",
    prepare: "Runs after install (git hooks)",
    postinstall: "Runs after install",
    generate: "Code generation",
    migrate: "Run database migrations",
    "db:push": "Push schema to the database",
    "db:migrate": "Run database migrations",
    "db:seed": "Seed the database",
    "db:studio": "Open the database GUI",
    storybook: "Component workbench",
    e2e: "End-to-end tests",
    vet: "Static analysis",
    clippy: "Lints",
    run: "Run",
  };
  if (known[name]) return known[name];
  if (/^make /.test(c)) return `Make target`;
  // Fall back to the command itself, shortened.
  const short = c.length > 60 ? c.slice(0, 57) + "…" : c;
  return `\`${cell(short, 80)}\``;
}

function seedInvariants(r) {
  const out = [];
  const names = new Set(r.stack.map((s) => s.name));
  if (names.has("Convex")) {
    out.push("Identity in Convex functions comes from `ctx.auth.getUserIdentity()`, never from a `userId` argument — a client can pass anyone's id.");
    out.push("Convex `_generated/` is machine-written while `npx convex dev` runs. Hand edits are overwritten and hide schema mistakes until deploy.");
  }
  if (names.has("Prisma")) out.push("Schema changes go through `prisma migrate dev`, never by editing the database directly; the migration history is the source of truth.");
  if (names.has("Stripe")) out.push("Stripe webhooks verify the signature against the **raw** request body. Any middleware that parses JSON first breaks verification silently in production.");
  if (names.has("Clerk") && r.framework?.name === "Next.js") out.push("Clerk hooks throw outside `<ClerkProvider>`. If the provider is conditional anywhere, every hook import must go through a wrapper that tolerates its absence.");
  if (names.has("App Router")) out.push("Setting `openGraph` in a page's `metadata` replaces, not merges, the parent's — so it drops the inherited image. Centralise social metadata in one helper.");
  if (names.has("TanStack Query") || names.has("SWR")) out.push("Query keys are the cache. A key that omits a parameter the fetcher uses serves stale data for the other value.");
  if (names.has("Zustand") || names.has("Redux Toolkit")) out.push("Store state is not persisted unless a persist middleware is configured — check before assuming a reload keeps it.");
  if (r.framework?.name === "Expo") out.push("The bundle identifier is permanent once the app exists in App Store Connect / Play Console. Change it before the first store build, never after.");
  return out;
}

function seedWhereThingsGo(r) {
  const rows = [];
  const names = new Set(r.stack.map((s) => s.name));
  const hasSrcApp = r.layout.some((l) => l.path === "src" && l.children?.some((c) => c.path === "src/app"));
  const appDir = hasSrcApp ? "src/app" : r.layout.some((l) => l.path === "app") ? "app" : null;
  if (appDir) {
    rows.push(["A new page", `\`${appDir}/<route>/page.tsx\`; a \`layout.tsx\` beside it for metadata and shared chrome`]);
    rows.push(["An API endpoint", `\`${appDir}/api/<name>/route.ts\``]);
  } else if (r.layout.some((l) => l.path === "pages")) {
    rows.push(["A new page", "`pages/<route>.tsx`"]);
    rows.push(["An API endpoint", "`pages/api/<name>.ts`"]);
  }
  if (names.has("Convex")) {
    rows.push(["A new table", "`convex/schema.ts` with an index for every way it's queried; functions in `convex/<table>.ts`"]);
  }
  if (names.has("Prisma")) rows.push(["A new model", "`prisma/schema.prisma`, then `prisma migrate dev --name <what>`"]);
  if (names.has("Drizzle")) rows.push(["A new table", "the schema file, then `drizzle-kit generate` and `migrate`"]);
  const comps = r.layout.find((l) => l.path === "components") ? "components" : r.layout.some((l) => l.children?.some((c) => c.path === "src/components")) ? "src/components" : null;
  if (comps) rows.push(["A reusable component", `\`${comps}/<name>.tsx\`${names.has("shadcn/ui") ? "; primitives from shadcn go in `" + comps + "/ui/` via the CLI" : ""}`]);
  const lib = r.layout.some((l) => l.children?.some((c) => c.path === "src/lib")) ? "src/lib" : r.layout.find((l) => l.path === "lib") ? "lib" : null;
  if (lib) rows.push(["A helper with no React in it", `\`${lib}/\``]);
  if (r.tests) rows.push(["A test", `next to the file it tests, run with \`${r.tests.script ?? r.tests.runner}\``]);
  return rows;
}
