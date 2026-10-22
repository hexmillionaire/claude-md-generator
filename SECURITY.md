# Security

Report vulnerabilities through GitHub's [private vulnerability reporting](https://github.com/hexmillionaire/claude-md-generator/security/advisories/new). Please don't open a public issue with exploit details.

## What this tool does and doesn't do

- **Reads files only.** It never executes code from the scanned repository, never spawns processes, never loads its modules, and makes no network requests. It is safe to run on a repository you don't trust yet.
- **Writes one file** (`CLAUDE.md`, or `CLAUDE.generated.md` / the `--out` path), plus `AGENTS.md` with `--agents`. It refuses to overwrite an existing `CLAUDE.md` without `--force`, and it never writes through a symbolic link: if the target path is a link (even a dangling one) or anything other than a regular file, it stops with an error instead of following it.
- **Repository text is treated as data, not instructions.** Names, descriptions, script commands, config values and comments read from the repository are flattened to a single line, stripped of Markdown syntax and length-capped before they are rendered, so a repository cannot write its own headings or instructions into the generated file.
- **Env var values are never read.** It records variable *names* from `.env.example`-style files and from source code. It does not open `.env`, `.env.local` or any other file that could hold real secrets.
- **Zero runtime dependencies**, so there is no transitive supply chain to audit.

Review the generated file before committing it: it lists your environment variable names and folder layout, which you may not want public.
