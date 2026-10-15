import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve, join } from "node:path";
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
  if (existsSync(outPath) && !opts.force) {
    const alt = resolve(dir, "CLAUDE.generated.md");
    writeFileSync(alt, md);
    console.error(
      `${rel(dir, outPath)} already exists. Wrote ${rel(dir, alt)} instead.\n` +
        `Merge what's useful, or re-run with --force to overwrite.`
    );
    return 0;
  }

  writeFileSync(outPath, md);
  console.error(`Wrote ${rel(dir, outPath)}`);

  if (opts.agents) {
    const agentsPath = join(dir, "AGENTS.md");
    if (!existsSync(agentsPath) || opts.force) {
      writeFileSync(agentsPath, agentsPointer(result));
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
