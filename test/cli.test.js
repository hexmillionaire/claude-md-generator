import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync, readFileSync, existsSync, cpSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "../src/cli.js";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const bin = join(root, "bin", "claude-md.js");
const fixture = join(root, "test", "fixtures", "vite-prisma-stripe");

function tmpCopy() {
  const d = mkdtempSync(join(tmpdir(), "cmg-"));
  cpSync(fixture, d, { recursive: true });
  return d;
}
const run = (args, opts = {}) =>
  execFileSync(process.execPath, [bin, ...args], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], ...opts });

test("parseArgs", () => {
  assert.deepEqual(parseArgs([]).dir, ".");
  assert.equal(parseArgs(["./x", "--print"]).print, true);
  assert.equal(parseArgs(["--out", "docs/AGENT.md"]).out, "docs/AGENT.md");
  assert.equal(parseArgs(["--out=X.md"]).out, "X.md");
  assert.throws(() => parseArgs(["--nope"]), /unknown option/);
});

test("--print writes nothing", () => {
  const d = tmpCopy();
  const out = run([d, "--print"]);
  assert.match(out, /^# shop — agent notes/);
  assert.equal(existsSync(join(d, "CLAUDE.md")), false);
});

test("writes CLAUDE.md, refuses to clobber, honours --force and --agents", () => {
  const d = tmpCopy();
  run([d]);
  assert.ok(existsSync(join(d, "CLAUDE.md")));

  writeFileSync(join(d, "CLAUDE.md"), "hand-written\n");
  run([d]);
  assert.equal(readFileSync(join(d, "CLAUDE.md"), "utf8"), "hand-written\n", "existing file untouched");
  assert.ok(existsSync(join(d, "CLAUDE.generated.md")), "wrote alongside instead");

  run([d, "--force", "--agents"]);
  assert.match(readFileSync(join(d, "CLAUDE.md"), "utf8"), /^# shop — agent notes/);
  assert.match(readFileSync(join(d, "AGENTS.md"), "utf8"), /CLAUDE\.md/);
});

test("--json emits the scan", () => {
  const d = tmpCopy();
  const j = JSON.parse(run([d, "--json"]));
  assert.equal(j.framework.name, "React + Vite");
});

test("missing dir exits 1", () => {
  assert.throws(() => run(["/definitely/not/here"]), /no such directory/);
});
