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

## Releasing

Releases are published by `.github/workflows/publish.yml`, never from a laptop.

1. In a PR, bump `version` in `package.json` and rename `## Unreleased` in `CHANGELOG.md` to `## <version> — <date>`. Merge it.
2. Tag the merge commit on `main` and push the tag:

   ```bash
   git tag v<version> origin/main && git push origin v<version>
   ```

The workflow refuses a tag that does not match `package.json`, has no changelog section, or is not on `main`. It runs the tests, then publishes with npm trusted publishing (GitHub OIDC, no stored token) and a provenance attestation.
