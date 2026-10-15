# Contributing

Thanks for helping. The most useful contributions are small:

- **A library it doesn't recognise** — one row in `STACK` in `src/scan.js`, plus the dependency in a fixture's `package.json` and an assertion in `test/scan.test.js`.
- **A wrong or missing gotcha** — the fourth column of `STACK`, or `seedInvariants()` in `src/render.js`. One line, and only things that are true for nearly every project using that library.
- **Output that read badly on your repo** — open an issue with the `--json` output (redact anything private) and what you expected.

## Rules

Read [CLAUDE.md](CLAUDE.md) first; it's short. The ones that matter:

- Zero runtime dependencies.
- `scan()` reads files and nothing else.
- Generated output stays under ~150 lines.

## Workflow

```bash
npm test              # Node 18+; CI also runs 20, 22, 24, Windows and macOS
npm run try           # generate this repo's CLAUDE.md to stdout
node bin/claude-md.js ../some-repo --json
```
