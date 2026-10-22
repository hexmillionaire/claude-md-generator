import { existsSync, readFileSync, writeFileSync, lstatSync, renameSync, rmSync } from "node:fs";
import { resolve, join, dirname, basename } from "node:path";
import { scan } from "./scan.js";
import { render } from "./render.js";

const HELP = `claude-md-generator — draft a CLAUDE.md from what's actually in the repo

Usage
  npx claude-md-generator [dir] [options]

Options
  --out <file>     Write to this file instead of CLAUDE.md
  --print          Print to stdout, write nothing
  --force          Overwrite an existing CLAUDE.md
  --agents         Also write AGENTS.md pointing at CLAUDE.md (for Cursor, Codex, etc.)
  --json           Print the scan result as JSON (for debugging detection)
  -h, --help       This

What it does
  Reads package.json / pyproject / go.mod / Cargo.toml, lockfiles, folder
  layout, .env.example, CI config and existing docs. Writes a CLAUDE.md with
  the stack, commands, layout and env vars filled in, and a scaffold for the
  parts only you know: the invariants that break the app, and where new
  things go. Nothing leaves your machine.`;

export function parseArgs(argv) {
  const opts = { dir: ".", out: null, print: false, force: false, agents: false, json: false, help: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "-h" || a === "--help") opts.help = true;
    else if (a === "--print") opts.print = true;
    else if (a === "--force") opts.force = true;
    else if (a === "--agents") opts.agents = true;
    else if (a === "--json") opts.json = true;
    else if (a === "--out") opts.out = argv[++i];
    else if (a.startsWith("--out=")) opts.out = a.slice(6);
    else if (a.startsWith("-")) throw new Error(`unknown option ${a} (try --help)`);
    else opts.dir = a;
  }
  return opts;
}

export async function run(argv) {
  const opts = parseArgs(argv);
  if (opts.help) {
    console.log(HELP);
    return 0;
  }

  const dir = resolve(opts.dir);
  if (!existsSync(dir)) throw new Error(`no such directory: ${dir}`);

  const result = scan(dir);

  if (opts.json) {
    console.log(JSON.stringify(result, null, 2));
    return 0;
  }

  const md = render(result);

  if (opts.print) {
    process.stdout.write(md);
    return 0;
  }

  const outPath = resolve(dir, opts.out ?? "CLAUDE.md");
  const outState = pathState(outPath);
  if (outState === "symlink") throw new Error(`refusing to write ${outPath}: it is a symbolic link`);
  if (outState === "other") throw new Error(`refusing to write ${outPath}: not a regular file`);
  if (outState === "file" && !opts.force) {
    const alt = resolve(dir, "CLAUDE.generated.md");
    writeFile(alt, md, { overwrite: true });
    console.error(
      `${rel(dir, outPath)} already exists. Wrote ${rel(dir, alt)} instead.\n` +
        `Merge what's useful, or re-run with --force to overwrite.`
    );
    return 0;
  }

  writeFile(outPath, md, { overwrite: opts.force });
  console.error(`Wrote ${rel(dir, outPath)}`);

  if (opts.agents) {
    const agentsPath = join(dir, "AGENTS.md");
    if (pathState(agentsPath) === "missing" || opts.force) {
      writeFile(agentsPath, agentsPointer(result), { overwrite: opts.force });
      console.error(`Wrote AGENTS.md`);
    } else {
      console.error(`AGENTS.md already exists, left alone.`);
    }
  }

  const todo = (md.match(/<!-- TODO/g) ?? []).length;
  if (todo) {
    console.error(
      `\n${todo} TODO ${todo === 1 ? "block" : "blocks"} left for you — search the file for "TODO".\n` +
        `The invariants section is the one that matters most; the rest is already filled in.`
    );
  }
  return 0;
}

function rel(dir, p) {
  return p.startsWith(dir) ? p.slice(dir.length + 1) : p;
}

/**
 * What is at `p` without following symlinks: "missing", "file", "symlink"
 * or "other" (directory, socket, ...). `existsSync` is the wrong tool here:
 * it follows links, so a dangling symlink looks like free space.
 */
export function pathState(p) {
  let st;
  try {
    st = lstatSync(p);
  } catch (err) {
    if (err?.code === "ENOENT") return "missing";
    throw err;
  }
  if (st.isSymbolicLink()) return "symlink";
  if (st.isFile()) return "file";
  return "other";
}

/**
 * Write `content` to `p` without ever writing *through* the path. The scanned
 * repository is untrusted and git preserves symlinks on clone, so a planted
 * `CLAUDE.md -> ~/.zshrc` must not turn this tool into an arbitrary-file
 * writer. Rules: a symlink or non-regular file at `p` is refused outright;
 * a missing path is created exclusively (`wx`, which does not follow links);
 * an existing regular file is replaced only with `overwrite`, via a sibling
 * temp file and an atomic rename, so a race can at most swap the path, never
 * redirect the write.
 */
export function writeFile(p, content, { overwrite = false } = {}) {
  const state = pathState(p);
  if (state === "symlink") throw new Error(`refusing to write ${p}: it is a symbolic link`);
  if (state === "other") throw new Error(`refusing to write ${p}: not a regular file`);
  if (state === "missing") {
    writeFileSync(p, content, { flag: "wx" });
    return;
  }
  if (!overwrite) throw new Error(`refusing to overwrite ${p} without --force`);
  const tmp = join(dirname(p), `.${basename(p)}.${process.pid}.${Date.now().toString(36)}.tmp`);
  writeFileSync(tmp, content, { flag: "wx" });
  try {
    renameSync(tmp, p);
  } catch (err) {
    rmSync(tmp, { force: true });
    throw err;
  }
}

function agentsPointer(result) {
  const lines = [];
  if (result.framework?.name === "Next.js" && result.framework.major >= 15) {
    lines.push(
      `# This is NOT the Next.js you know`,
      ``,
      `This project is on Next.js ${result.framework.version}. APIs, conventions and file`,
      `structure differ from most training data. Read the relevant guide in`,
      `\`node_modules/next/dist/docs/\` before writing framework code and heed`,
      `deprecation notices.`,
      ``
    );
  }
  lines.push(
    `Architecture notes, invariants and where-things-go live in \`CLAUDE.md\`.`,
    `Read it before changing anything; it is short and tool-agnostic despite the name.`,
    ``
  );
  return lines.join("\n");
}

// Exposed for tests.
export function readFile(p) {
  return readFileSync(p, "utf8");
}
