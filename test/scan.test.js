import { test } from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { scan } from "../src/scan.js";
import { render } from "../src/render.js";

const fixtures = join(dirname(fileURLToPath(import.meta.url)), "fixtures");
const fx = (name) => scan(join(fixtures, name));
const names = (r) => r.stack.map((s) => s.name);

test("vite + react + prisma + stripe", () => {
  const r = fx("vite-prisma-stripe");
  assert.equal(r.language, "TypeScript");
  assert.equal(r.packageManager, "pnpm");
  assert.equal(r.framework.name, "React + Vite");
  assert.ok(names(r).includes("Prisma"));
  assert.ok(names(r).includes("Stripe"));
  assert.ok(names(r).includes("Zustand"));
  assert.equal(r.tests.runner, "Vitest");
  assert.ok(r.conventions.some((c) => /strict/.test(c)));
  assert.ok(r.conventions.some((c) => /Prettier/.test(c)));
  assert.ok(r.conventions.some((c) => /`~\/\*`/.test(c)));
  assert.deepEqual(r.ci, [{ file: ".github/workflows/ci.yml", name: "CI" }]);
});

test("env: merges .env.example with vars read in code, flags public prefixes", () => {
  const r = fx("vite-prisma-stripe");
  const byName = Object.fromEntries(r.env.map((e) => [e.name, e]));
  assert.equal(byName.STRIPE_SECRET_KEY.comment, "Stripe secret from the dashboard");
  assert.equal(byName.STRIPE_SECRET_KEY.public, false);
  assert.equal(byName.VITE_STRIPE_PK.public, true);
  assert.ok(byName.VITE_STRIPE_PK.sources.includes("src/main.tsx"));
  assert.ok(byName.SENTRY_DSN, "process.env.SENTRY_DSN found by grep");
  assert.equal(byName.DATABASE_URL.comment, "Postgres");
});

test("python fastapi via pyproject + Makefile", () => {
  const r = fx("python-fastapi");
  assert.equal(r.language, "Python");
  assert.equal(r.framework.name, "FastAPI");
  assert.ok(names(r).includes("SQLAlchemy"));
  assert.equal(r.tests.runner, "pytest");
  assert.equal(r.scripts.dev, "make dev");
  assert.ok(r.conventions.some((c) => /Ruff/.test(c)));
  const env = r.env.map((e) => e.name);
  assert.ok(env.includes("DATABASE_URL"), "os.environ[...] detected");
  assert.ok(env.includes("STRIPE_SECRET_KEY"), "os.environ.get(...) detected");
});

test("plain node esm lib", () => {
  const r = fx("plain-node");
  assert.equal(r.language, "JavaScript");
  assert.equal(r.framework, null);
  assert.ok(r.conventions.some((c) => /ESM/.test(c)));
  assert.equal(r.tests.script, "node --test");
});

test("empty dir degrades to TODOs, no throw", () => {
  const r = fx("empty");
  assert.equal(r.language, null);
  assert.ok(r.warnings.length >= 1);
  const md = render(r);
  assert.match(md, /TODO: list the stack/);
  assert.match(md, /TODO: how to run/);
});

test("render: facts present, TODOs present, stays short", () => {
  const md = render(fx("vite-prisma-stripe"));
  assert.match(md, /^# shop — agent notes/m);
  assert.match(md, /A tiny shop\./);
  assert.match(md, /\| `pnpm dev` \| Dev server \|/);
  assert.match(md, /Before saying "done":\*\* `pnpm lint` → `pnpm test` → `pnpm build`/);
  assert.match(md, /Stripe webhooks verify the signature against the \*\*raw\*\* request body/);
  assert.match(md, /A new model \| `prisma\/schema.prisma`/);
  assert.match(md, /## Invariants that are easy to break/);
  assert.ok((md.match(/<!-- TODO/g) ?? []).length >= 3, "leaves TODOs for the author");
  assert.ok(md.split("\n").length < 150, "fits in an agent's attention");
});

test("render: no .env.example nudges to create one", () => {
  const md = render(fx("python-fastapi"));
  assert.match(md, /There is no `\.env\.example`/);
});

test("render: next.js 15+ gets the training-data warning", () => {
  const r = fx("plain-node");
  r.framework = { name: "Next.js", version: "16.0.0", major: 16 };
  r.stack = [{ name: "App Router", kind: "routing", version: null, note: null }];
  const md = render(r);
  assert.match(md, /newer than most training data/);
  assert.match(md, /proxy\.ts/);
});

test("env grep skips test and fixture trees", () => {
  const r = scan(join(dirname(fileURLToPath(import.meta.url)), ".."));
  assert.deepEqual(r.env, [], "the generator's own repo reads no env vars outside fixtures");
});
