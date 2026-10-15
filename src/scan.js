import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

/**
 * Everything the generator knows comes from here. It reads files; it never
 * executes anything and never touches the network.
 */
export function scan(dir) {
  const pkg = readJson(join(dir, "package.json"));
  const result = {
    dir,
    name: pkg?.name ?? basename(dir),
    description: pkg?.description ?? null,
    language: null,
    packageManager: detectPackageManager(dir, pkg),
    monorepo: detectMonorepo(dir, pkg),
    framework: null,
    stack: [],
    scripts: pkg?.scripts ?? {},
    layout: [],
    env: [],
    conventions: [],
    ci: [],
    docs: [],
    tests: null,
    warnings: [],
  };

  if (pkg) {
    result.language = detectTsOrJs(dir, pkg);
    const deps = { ...(pkg.dependencies ?? {}), ...(pkg.devDependencies ?? {}) };
    result.framework = detectFramework(deps);
    result.stack = detectStack(deps, dir);
    result.tests = detectTests(deps, pkg.scripts ?? {});
    result.conventions.push(...detectJsConventions(dir, pkg, deps));
  } else if (existsSync(join(dir, "pyproject.toml")) || existsSync(join(dir, "requirements.txt"))) {
    result.language = "Python";
    Object.assign(result, scanPython(dir));
  } else if (existsSync(join(dir, "go.mod"))) {
    result.language = "Go";
    result.framework = { name: "Go module", version: firstLine(join(dir, "go.mod")).replace(/^module\s+/, "") };
    result.scripts = { build: "go build ./...", test: "go test ./...", vet: "go vet ./..." };
  } else if (existsSync(join(dir, "Cargo.toml"))) {
    result.language = "Rust";
    result.scripts = { build: "cargo build", test: "cargo test", run: "cargo run", clippy: "cargo clippy" };
  } else {
    result.warnings.push("No package.json, pyproject.toml, go.mod or Cargo.toml found — stack detection is limited.");
  }

  result.layout = scanLayout(dir);
  result.env = scanEnv(dir);
  result.ci = scanCi(dir);
  result.docs = scanDocs(dir);
  return result;
}

// ── helpers ──────────────────────────────────────────────────────────────

function readJson(p) {
  try {
    return JSON.parse(readFileSync(p, "utf8"));
  } catch {
    return null;
  }
}
function readText(p) {
  try {
    return readFileSync(p, "utf8");
  } catch {
    return "";
  }
}
function firstLine(p) {
  return readText(p).split("\n")[0] ?? "";
}
function basename(p) {
  return p.split(/[\\/]/).filter(Boolean).pop() ?? p;
}
function major(v) {
  const m = String(v ?? "").match(/(\d+)/);
  return m ? Number(m[1]) : null;
}
function clean(v) {
  return String(v ?? "").replace(/^[\^~>=<\s]+/, "");
}

const IGNORE_DIRS = new Set([
  "node_modules", ".git", ".next", ".turbo", "dist", "build", "out", "coverage", ".vercel", ".cache",
  "__pycache__", ".venv", "venv", "target", ".idea", ".vscode", ".DS_Store", ".expo", "ios", "android",
  ".convex", ".pytest_cache", ".mypy_cache", ".ruff_cache",
]);

function listDirs(p) {
  try {
    return readdirSync(p)
      .filter((n) => !IGNORE_DIRS.has(n) && !n.startsWith("."))
      .filter((n) => {
        try {
          return statSync(join(p, n)).isDirectory();
        } catch {
          return false;
        }
      })
      .sort();
  } catch {
    return [];
  }
}

function countFiles(p, depth = 0) {
  if (depth > 6) return 0;
  let n = 0;
  try {
    for (const e of readdirSync(p, { withFileTypes: true })) {
      if (IGNORE_DIRS.has(e.name) || e.name.startsWith(".")) continue;
      if (e.isDirectory()) n += countFiles(join(p, e.name), depth + 1);
      else n++;
    }
  } catch {}
  return n;
}

// ── detection ────────────────────────────────────────────────────────────

function detectPackageManager(dir, pkg) {
  if (pkg?.packageManager) return pkg.packageManager.split("@")[0];
  if (existsSync(join(dir, "bun.lockb")) || existsSync(join(dir, "bun.lock"))) return "bun";
  if (existsSync(join(dir, "pnpm-lock.yaml"))) return "pnpm";
  if (existsSync(join(dir, "yarn.lock"))) return "yarn";
  if (existsSync(join(dir, "package-lock.json"))) return "npm";
  if (existsSync(join(dir, "uv.lock"))) return "uv";
  if (existsSync(join(dir, "poetry.lock"))) return "poetry";
  if (existsSync(join(dir, "Pipfile.lock"))) return "pipenv";
  return pkg ? "npm" : null;
}

function detectMonorepo(dir, pkg) {
  if (pkg?.workspaces) return { tool: "npm/yarn workspaces", packages: pkg.workspaces.packages ?? pkg.workspaces };
  if (existsSync(join(dir, "pnpm-workspace.yaml"))) return { tool: "pnpm workspaces", packages: [] };
  if (existsSync(join(dir, "turbo.json"))) return { tool: "Turborepo", packages: [] };
  if (existsSync(join(dir, "nx.json"))) return { tool: "Nx", packages: [] };
  return null;
}

function detectTsOrJs(dir, pkg) {
  const deps = { ...(pkg.dependencies ?? {}), ...(pkg.devDependencies ?? {}) };
  if (deps.typescript || existsSync(join(dir, "tsconfig.json"))) return "TypeScript";
  return "JavaScript";
}

const FRAMEWORKS = [
  ["next", "Next.js"],
  ["nuxt", "Nuxt"],
  ["@remix-run/react", "Remix"],
  ["react-router", "React Router"],
  ["@sveltejs/kit", "SvelteKit"],
  ["astro", "Astro"],
  ["expo", "Expo"],
  ["react-native", "React Native"],
  ["@angular/core", "Angular"],
  ["vue", "Vue"],
  ["svelte", "Svelte"],
  ["solid-js", "SolidJS"],
  ["@nestjs/core", "NestJS"],
  ["fastify", "Fastify"],
  ["hono", "Hono"],
  ["express", "Express"],
  ["electron", "Electron"],
  ["vite", "Vite"],
  ["react", "React"],
];

function detectFramework(deps) {
  // Vite is a bundler, not a framework; name the UI library it serves.
  if (deps.vite && !deps.next && !deps.astro && !deps["@sveltejs/kit"] && !deps["@remix-run/react"] && !deps.nuxt) {
    const ui = deps.react ? "React" : deps.vue ? "Vue" : deps.svelte ? "Svelte" : deps["solid-js"] ? "SolidJS" : null;
    const version = clean(deps.vite);
    return { name: ui ? `${ui} + Vite` : "Vite", version, major: major(version), pkg: "vite" };
  }
  for (const [key, name] of FRAMEWORKS) {
    if (deps[key]) {
      const version = clean(deps[key]);
      return { name, version, major: major(version), pkg: key };
    }
  }
  return null;
}

const STACK = [
  // backend / data
  ["convex", "Convex", "backend", "Realtime DB + serverless functions. Regenerates `convex/_generated/` while `npx convex dev` runs — never hand-edit those."],
  ["@supabase/supabase-js", "Supabase", "backend", null],
  ["firebase", "Firebase", "backend", null],
  ["@prisma/client", "Prisma", "orm", "Schema in `prisma/schema.prisma`; run `prisma generate` after changing it and `prisma migrate dev` for the DB."],
  ["drizzle-orm", "Drizzle", "orm", null],
  ["mongoose", "Mongoose", "orm", null],
  ["kysely", "Kysely", "orm", null],
  ["pg", "PostgreSQL (pg)", "db", null],
  ["mysql2", "MySQL", "db", null],
  ["better-sqlite3", "SQLite", "db", null],
  ["redis", "Redis", "db", null],
  ["ioredis", "Redis", "db", null],
  // auth
  ["@clerk/nextjs", "Clerk", "auth", null],
  ["@clerk/clerk-react", "Clerk", "auth", null],
  ["@clerk/clerk-expo", "Clerk", "auth", null],
  ["next-auth", "NextAuth / Auth.js", "auth", null],
  ["@auth/core", "Auth.js", "auth", null],
  ["@auth0/nextjs-auth0", "Auth0", "auth", null],
  ["@auth0/auth0-react", "Auth0", "auth", null],
  ["better-auth", "Better Auth", "auth", null],
  ["@workos-inc/node", "WorkOS", "auth", null],
  ["lucia", "Lucia", "auth", null],
  // payments
  ["stripe", "Stripe", "payments", "Webhook handlers must verify signatures with the raw body; never parse JSON first."],
  ["@paddle/paddle-node-sdk", "Paddle", "payments", null],
  ["@lemonsqueezy/lemonsqueezy.js", "Lemon Squeezy", "payments", null],
  // styling / ui
  ["tailwindcss", "Tailwind CSS", "styling", null],
  ["@tailwindcss/postcss", "Tailwind CSS v4", "styling", null],
  ["shadcn", "shadcn/ui", "ui", null],
  ["@radix-ui/react-dialog", "Radix UI", "ui", null],
  ["@base-ui/react", "Base UI", "ui", null],
  ["@mui/material", "MUI", "ui", null],
  ["@chakra-ui/react", "Chakra UI", "ui", null],
  ["styled-components", "styled-components", "styling", null],
  ["@emotion/react", "Emotion", "styling", null],
  ["sass", "Sass", "styling", null],
  ["lucide-react", "Lucide icons", "ui", null],
  ["framer-motion", "Framer Motion", "ui", null],
  ["motion", "Motion", "ui", null],
  // state / data fetching
  ["@tanstack/react-query", "TanStack Query", "data", null],
  ["swr", "SWR", "data", null],
  ["zustand", "Zustand", "state", null],
  ["jotai", "Jotai", "state", null],
  ["@reduxjs/toolkit", "Redux Toolkit", "state", null],
  ["redux", "Redux", "state", null],
  ["xstate", "XState", "state", null],
  ["@trpc/server", "tRPC", "api", null],
  ["graphql", "GraphQL", "api", null],
  ["@apollo/client", "Apollo Client", "api", null],
  // forms / validation
  ["zod", "Zod", "validation", null],
  ["valibot", "Valibot", "validation", null],
  ["yup", "Yup", "validation", null],
  ["react-hook-form", "React Hook Form", "forms", null],
  // ai
  ["@anthropic-ai/sdk", "Anthropic SDK", "ai", null],
  ["openai", "OpenAI SDK", "ai", null],
  ["ai", "Vercel AI SDK", "ai", null],
  ["@langchain/core", "LangChain", "ai", null],
  ["langchain", "LangChain", "ai", null],
  // web3
  ["viem", "viem", "web3", null],
  ["wagmi", "wagmi", "web3", null],
  ["ethers", "ethers", "web3", null],
  ["@solana/web3.js", "Solana web3.js", "web3", null],
  // email / jobs / misc
  ["resend", "Resend", "email", null],
  ["nodemailer", "Nodemailer", "email", null],
  ["@react-email/components", "React Email", "email", null],
  ["bullmq", "BullMQ", "jobs", null],
  ["inngest", "Inngest", "jobs", null],
  ["@trigger.dev/sdk", "Trigger.dev", "jobs", null],
  ["web-push", "Web Push", "notifications", null],
  ["socket.io", "Socket.IO", "realtime", null],
  ["@vercel/analytics", "Vercel Analytics", "analytics", null],
  ["posthog-js", "PostHog", "analytics", null],
  ["@sentry/nextjs", "Sentry", "monitoring", null],
  ["@sentry/node", "Sentry", "monitoring", null],
  ["next-themes", "next-themes", "ui", null],
  ["next-intl", "next-intl", "i18n", null],
  ["i18next", "i18next", "i18n", null],
  ["recharts", "Recharts", "charts", null],
  ["d3", "D3", "charts", null],
  ["three", "Three.js", "3d", null],
  ["@react-three/fiber", "React Three Fiber", "3d", null],
  ["puppeteer", "Puppeteer", "browser", null],
  ["playwright", "Playwright", "browser", null],
  ["sharp", "sharp", "images", null],
];

function detectStack(deps, dir) {
  const found = [];
  const seen = new Set();
  for (const [key, name, kind, note] of STACK) {
    if (deps[key] && !seen.has(name)) {
      seen.add(name);
      found.push({ name, kind, version: clean(deps[key]), note });
    }
  }
  // Tailwind v4 shows up as @tailwindcss/postcss; collapse the two.
  if (seen.has("Tailwind CSS v4")) {
    const i = found.findIndex((s) => s.name === "Tailwind CSS");
    if (i >= 0) found.splice(i, 1);
    const v4 = found.find((s) => s.name === "Tailwind CSS v4");
    if (v4) v4.version = null;
  }
  // Convex + Clerk together: the integration has its own gotcha.
  if (seen.has("Convex") && seen.has("Clerk")) {
    found.push({
      name: "Convex ↔ Clerk",
      kind: "integration",
      version: null,
      note: "Convex validates Clerk JWTs via `convex/auth.config.ts`; the Clerk JWT template must be named `convex` and its issuer set with `npx convex env set CLERK_JWT_ISSUER_DOMAIN`.",
    });
  }
  // Next.js App Router vs Pages Router.
  if (deps.next) {
    const app = existsSync(join(dir, "app")) || existsSync(join(dir, "src", "app"));
    const pages = existsSync(join(dir, "pages")) || existsSync(join(dir, "src", "pages"));
    if (app && !pages) found.unshift({ name: "App Router", kind: "routing", version: null, note: null });
    else if (pages && !app) found.unshift({ name: "Pages Router", kind: "routing", version: null, note: null });
    else if (app && pages) found.unshift({ name: "App Router + Pages Router (mixed)", kind: "routing", version: null, note: "Both routers present — check which one a route lives in before editing." });
  }
  return found;
}

function detectTests(deps, scripts) {
  const runners = [
    ["vitest", "Vitest"],
    ["jest", "Jest"],
    ["@playwright/test", "Playwright"],
    ["cypress", "Cypress"],
    ["mocha", "Mocha"],
    ["ava", "AVA"],
  ];
  for (const [key, name] of runners) if (deps[key]) return { runner: name, script: scripts.test ?? null };
  if (scripts.test && !/no test specified/.test(scripts.test)) return { runner: "node --test or custom", script: scripts.test };
  return null;
}

function detectJsConventions(dir, pkg, deps) {
  const c = [];
  const ts = readJson(join(dir, "tsconfig.json"));
  if (ts?.compilerOptions?.strict) c.push("TypeScript `strict` is on.");
  const paths = ts?.compilerOptions?.paths;
  if (paths && Object.keys(paths).length) {
    c.push(
      "Path aliases: " +
        Object.entries(paths)
          .slice(0, 4)
          .map(([k, v]) => `\`${k}\` → \`${Array.isArray(v) ? v[0] : v}\``)
          .join(", ") +
        "."
    );
  }
  if (deps.eslint || existsSync(join(dir, "eslint.config.mjs")) || existsSync(join(dir, "eslint.config.js")) || existsSync(join(dir, ".eslintrc.json")))
    c.push("ESLint is configured; run it before finishing.");
  if (deps.prettier || existsSync(join(dir, ".prettierrc")) || existsSync(join(dir, "prettier.config.js")))
    c.push("Prettier is configured; don't hand-format.");
  if (deps.biome || deps["@biomejs/biome"]) c.push("Biome handles lint + format.");
  if (deps.husky || deps["lint-staged"] || deps["simple-git-hooks"]) c.push("Git hooks run on commit (husky/lint-staged); a failing hook is not something to bypass with `--no-verify`.");
  if (pkg.type === "module") c.push("Package is ESM (`\"type\": \"module\"`): use `import`, not `require`.");
  if (existsSync(join(dir, "components.json"))) {
    const cj = readJson(join(dir, "components.json"));
    const style = cj?.style ? ` (style: \`${cj.style}\`)` : "";
    c.push(`shadcn/ui components live in \`${cj?.aliases?.ui ?? "components/ui"}\`${style}; add new ones with \`npx shadcn@latest add <name>\` rather than writing them by hand.`);
  }
  return c;
}

function scanPython(dir) {
  const out = { stack: [], scripts: {}, conventions: [], tests: null, framework: null };
  const py = readText(join(dir, "pyproject.toml")) + "\n" + readText(join(dir, "requirements.txt"));
  const has = (re) => re.test(py);
  const fw = [
    [/\bfastapi\b/i, "FastAPI"],
    [/\bdjango\b/i, "Django"],
    [/\bflask\b/i, "Flask"],
    [/\bstreamlit\b/i, "Streamlit"],
  ];
  for (const [re, name] of fw) if (has(re)) { out.framework = { name, version: null, major: null }; break; }
  const libs = [
    [/\bsqlalchemy\b/i, "SQLAlchemy", "orm"],
    [/\bpydantic\b/i, "Pydantic", "validation"],
    [/\bcelery\b/i, "Celery", "jobs"],
    [/\bpandas\b/i, "pandas", "data"],
    [/\bnumpy\b/i, "NumPy", "data"],
    [/\btorch\b/i, "PyTorch", "ml"],
    [/\banthropic\b/i, "Anthropic SDK", "ai"],
    [/\bopenai\b/i, "OpenAI SDK", "ai"],
    [/\bhttpx\b/i, "httpx", "http"],
    [/\brequests\b/i, "requests", "http"],
  ];
  for (const [re, name, kind] of libs) if (has(re)) out.stack.push({ name, kind, version: null, note: null });
  if (has(/\bpytest\b/i)) out.tests = { runner: "pytest", script: "pytest" };
  if (has(/\bruff\b/i)) out.conventions.push("Ruff handles lint + format.");
  if (has(/\bmypy\b/i)) out.conventions.push("mypy type checks; keep annotations complete.");
  if (has(/\bblack\b/i)) out.conventions.push("Black formats; don't hand-format.");
  if (existsSync(join(dir, "Makefile"))) {
    const targets = [...readText(join(dir, "Makefile")).matchAll(/^([a-zA-Z0-9_-]+):/gm)].map((m) => m[1]);
    for (const t of targets.slice(0, 12)) out.scripts[t] = `make ${t}`;
  }
  if (out.framework?.name === "FastAPI" && !out.scripts.dev) out.scripts.dev = "uvicorn main:app --reload";
  if (out.framework?.name === "Django" && !out.scripts.dev) out.scripts.dev = "python manage.py runserver";
  if (out.tests && !out.scripts.test) out.scripts.test = "pytest";
  return out;
}

function scanLayout(dir) {
  const top = listDirs(dir);
  const rows = [];
  const DESC = {
    src: "application source",
    app: "routes (App Router: a folder per URL, `page.tsx` renders it, `layout.tsx` wraps it)",
    pages: "routes (Pages Router: a file per URL)",
    components: "React components",
    lib: "shared helpers, no React",
    hooks: "React hooks",
    utils: "shared helpers",
    convex: "Convex backend: `schema.ts` + one file per module; `_generated/` is machine-written",
    prisma: "Prisma schema and migrations",
    supabase: "Supabase config and migrations",
    public: "static assets served at `/`",
    scripts: "one-off scripts, not shipped",
    docs: "documentation",
    test: "tests",
    tests: "tests",
    __tests__: "tests",
    e2e: "end-to-end tests",
    styles: "global styles",
    types: "shared TypeScript types",
    api: "API routes / handlers",
    server: "server-side code",
    client: "client-side code",
    packages: "workspace packages",
    apps: "workspace apps",
    functions: "serverless functions",
    migrations: "database migrations",
    assets: "static assets",
    config: "configuration",
    data: "vendored data files",
    _generated: "machine-written — never edit by hand",
    i18n: "translations",
    locales: "translations",
    messages: "translations",
    emails: "email templates",
    workers: "background workers",
    cli: "command-line entry points",
    bin: "executables",
    examples: "examples",
    infra: "infrastructure as code",
    terraform: "infrastructure as code",
    ".github": "GitHub Actions and templates",
  };
  const describe = (name) => DESC[name] ?? null;

  for (const d of top) {
    const p = join(dir, d);
    const files = countFiles(p);
    const children = d === "src" || d === "app" || d === "convex" || d === "packages" || d === "apps" ? listDirs(p) : [];
    rows.push({ path: d, files, desc: describe(d), children: children.map((c) => ({ path: `${d}/${c}`, desc: describe(c), files: countFiles(join(p, c)) })) });
  }
  // Surface src/app's route folders one level down: they are the sitemap.
  for (const base of ["src/app", "app"]) {
    const p = join(dir, base);
    if (existsSync(p)) {
      const routes = listDirs(p).filter((r) => !r.startsWith("_") && !r.startsWith("("));
      const row = rows.find((r) => r.path === base.split("/")[0]);
      if (row) row.routes = routes.map((r) => `/${r.replace(/\[(\.\.\.)?([^\]]+)\]/g, ":$2")}`);
      break;
    }
  }
  return rows;
}

function scanEnv(dir) {
  const names = new Map();
  const add = (name, source, comment) => {
    if (!name || /^(NODE_ENV|PATH|HOME|PWD|CI)$/.test(name)) return;
    const cur = names.get(name) ?? { name, sources: new Set(), comment: null, public: /^(NEXT_PUBLIC_|VITE_|EXPO_PUBLIC_|PUBLIC_|REACT_APP_|NUXT_PUBLIC_)/.test(name) };
    cur.sources.add(source);
    if (comment && !cur.comment) cur.comment = comment;
    names.set(name, cur);
  };

  for (const f of [".env.example", ".env.sample", ".env.template", ".env.local.example", ".env.development.example"]) {
    const t = readText(join(dir, f));
    if (!t) continue;
    // A comment block above a var is its doc. Use the block's first real
    // line (the heading), not the last — trailing lines tend to be asides.
    let block = [];
    for (const line of t.split("\n")) {
      const s = line.trim();
      if (s.startsWith("#")) {
        const text = s.replace(/^#+\s?/, "").trim();
        if (text && !/^[─—\-=_#*·\s]+$/.test(text)) block.push(text.replace(/^[─—\-=\s]+|[─—\-=\s]+$/g, ""));
        continue;
      }
      const m = s.match(/^(?:export\s+)?([A-Z][A-Z0-9_]+)\s*=/);
      if (m) {
        // Join the block, split into sentences, take the first descriptive one.
        // Short heading-like lines (one or two words) are section labels, not docs.
        const sentences = block.filter((l) => l.split(/\s+/).length >= 3).join(" ").split(/(?<=[.!?])\s+/);
        const doc =
          sentences.find((l) => l.split(/\s+/).length >= 3 && l.length <= 140 && !/^(copy|leave|never|then run)/i.test(l)) ??
          block[0] ??
          null;
        add(m[1], f, doc);
        // Vars that share a block share the doc; reset only on a blank line.
        continue;
      }
      if (!s) block = [];
    }
  }

  // Grep source for process.env.X / import.meta.env.X — bounded walk.
  // Test and fixture trees are skipped: their env vars belong to the tests.
  const SKIP_ENV_DIRS = new Set(["test", "tests", "__tests__", "fixtures", "__fixtures__", "__mocks__", "e2e", "spec", "cypress", "storybook", ".storybook"]);
  const re = /(?:process\.env|import\.meta\.env|Deno\.env\.get\(|os\.environ(?:\.get)?\[?\(?)\s*[.\[("']?\s*([A-Z][A-Z0-9_]{2,})/g;
  let budget = 400;
  const walk = (p, depth) => {
    if (budget <= 0 || depth > 5) return;
    let entries;
    try {
      entries = readdirSync(p, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      if (budget <= 0) return;
      if (IGNORE_DIRS.has(e.name) || e.name.startsWith(".")) continue;
      const fp = join(p, e.name);
      if (e.isDirectory()) {
        if (!SKIP_ENV_DIRS.has(e.name)) walk(fp, depth + 1);
        continue;
      }
      else if (/\.(c|m)?[jt]sx?$|\.py$|\.vue$|\.svelte$|\.astro$/.test(e.name)) {
        budget--;
        let t;
        try {
          if (statSync(fp).size > 400_000) continue;
          t = readFileSync(fp, "utf8");
        } catch {
          continue;
        }
        for (const m of t.matchAll(re)) add(m[1], relative(dir, fp), null);
      }
    }
  };
  walk(dir, 0);

  return [...names.values()]
    .map((v) => ({ ...v, sources: [...v.sources] }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

function scanCi(dir) {
  const out = [];
  const gh = join(dir, ".github", "workflows");
  if (existsSync(gh)) {
    for (const f of readdirSync(gh).filter((n) => /\.ya?ml$/.test(n))) {
      const t = readText(join(gh, f));
      const name = (t.match(/^name:\s*(.+)$/m) ?? [])[1]?.trim();
      out.push({ file: `.github/workflows/${f}`, name: name ?? f });
    }
  }
  if (existsSync(join(dir, "vercel.json"))) out.push({ file: "vercel.json", name: "Vercel config" });
  if (existsSync(join(dir, "netlify.toml"))) out.push({ file: "netlify.toml", name: "Netlify config" });
  if (existsSync(join(dir, "Dockerfile"))) out.push({ file: "Dockerfile", name: "Docker image" });
  if (existsSync(join(dir, "docker-compose.yml")) || existsSync(join(dir, "compose.yaml"))) out.push({ file: "docker-compose", name: "Docker Compose services" });
  if (existsSync(join(dir, "fly.toml"))) out.push({ file: "fly.toml", name: "Fly.io config" });
  if (existsSync(join(dir, "railway.json")) || existsSync(join(dir, "railway.toml"))) out.push({ file: "railway", name: "Railway config" });
  if (existsSync(join(dir, "wrangler.toml")) || existsSync(join(dir, "wrangler.jsonc"))) out.push({ file: "wrangler", name: "Cloudflare Workers config" });
  if (existsSync(join(dir, "eas.json"))) out.push({ file: "eas.json", name: "Expo EAS build profiles" });
  return out;
}

function scanDocs(dir) {
  const out = [];
  for (const f of ["README.md", "CLAUDE.md", "AGENTS.md", "CONTRIBUTING.md", "ARCHITECTURE.md", "docs/WORKFLOW.md"]) {
    if (existsSync(join(dir, f))) out.push(f);
  }
  for (const skillsDir of [".claude/skills", ".agents/skills", ".cursor/rules"]) {
    const p = join(dir, skillsDir);
    if (existsSync(p)) {
      const n = listDirs(p).length || readdirSync(p).length;
      out.push(`${skillsDir}/ (${n})`);
    }
  }
  if (existsSync(join(dir, ".cursorrules"))) out.push(".cursorrules");
  return out;
}
