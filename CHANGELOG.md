# Changelog

## 0.1.1 — 2026-10-15

- Fix: env var source paths use forward slashes on Windows, so the generated file is identical across platforms.
- Fix: `npm test` works on Node 18 and 20 (named test files instead of a glob Node only expands from 21).
- Add: `skills/claude-md/SKILL.md`, a Claude Code skill that runs the generator, infers invariants from git history and asks for the rest.
- Add: `llms.txt`, SECURITY.md, CONTRIBUTING.md, issue templates.
- CI: Node 18/20/22/24 plus Windows and macOS; actions pinned to commit SHAs; read-only permissions.

## 0.1.0 — 2026-10-15

First release.
