import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync, readFileSync, existsSync, cpSync, symlinkSync, readdirSync } from "node:fs";
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

// A cloned repository is untrusted and git preserves symlinks, so a planted
// link must never turn the generator into a writer of arbitrary files.
const symlinks = { skip: process.platform === "win32" && "symlinks need privileges on Windows" };

test("refuses to write through a symlink in the clobber fallback", symlinks, () => {
  const d = tmpCopy();
  const victim = join(d, "victim.txt");
  writeFileSync(victim, "untouched\n");
  writeFileSync(join(d, "CLAUDE.md"), "hand-written\n");
  symlinkSync(victim, join(d, "CLAUDE.generated.md"));
  assert.throws(() => run([d]), /symbolic link/);
  assert.equal(readFileSync(victim, "utf8"), "untouched\n");
});

test("refuses a dangling symlink where CLAUDE.md would be created", symlinks, () => {
  const d = tmpCopy();
  const victim = join(d, "nested", "created.txt");
  symlinkSync(victim, join(d, "CLAUDE.md"));
  assert.throws(() => run([d]), /symbolic link/);
  assert.equal(existsSync(victim), false);
});

test("refuses to --force over a symlinked CLAUDE.md or AGENTS.md", symlinks, () => {
  const d = tmpCopy();
  const victim = join(d, "victim.txt");
  writeFileSync(victim, "untouched\n");
  symlinkSync(victim, join(d, "CLAUDE.md"));
  assert.throws(() => run([d, "--force"]), /symbolic link/);
  assert.equal(readFileSync(victim, "utf8"), "untouched\n");

  const d2 = tmpCopy();
  const victim2 = join(d2, "victim.txt");
  writeFileSync(victim2, "untouched\n");
  symlinkSync(victim2, join(d2, "AGENTS.md"));
  assert.throws(() => run([d2, "--force", "--agents"]), /symbolic link/);
  assert.equal(readFileSync(victim2, "utf8"), "untouched\n");
});

test("--force replaces a regular file atomically and leaves no temp file", () => {
  const d = tmpCopy();
  writeFileSync(join(d, "CLAUDE.md"), "old\n");
  run([d, "--force"]);
  assert.match(readFileSync(join(d, "CLAUDE.md"), "utf8"), /^# shop — agent notes/);
  assert.equal(readdirSync(d).filter((n) => n.endsWith(".tmp")).length, 0);
});
