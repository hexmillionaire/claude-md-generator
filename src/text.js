/**
 * Strings read from the scanned repository (package name, description,
 * script names, config values, comments in .env.example, workflow names) end
 * up in a file that agents read as instructions every session. A repository
 * must not be able to smuggle its own headings, lists or code fences into
 * that file. Every repo-sourced string goes through `flat` before it is
 * rendered: one line, no leading Markdown syntax, no backticks, bounded.
 */
export function flat(value, max = 200) {
  let s = String(value ?? "")
    // Control characters (keep ordinary whitespace, which the next step folds).
    .replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g, "")
    .replace(/\s+/g, " ")
    .replace(/`/g, "'")
    .trim();
  // Leading heading / quote / table / html / fence markers, and list markers
  // (`- `, `* `, `+ `) only when followed by a space, so `*.md` or `~/*` survive.
  s = s.replace(/^(?:[\s#>|<]|'{3,}|[-*+]\s)+/, "").trim();
  if (s.length > max) s = s.slice(0, max - 1).trimEnd() + "…";
  return s;
}

/** `flat`, plus pipe escaping for Markdown table cells. */
export function cell(value, max = 200) {
  return flat(value, max).replace(/\|/g, "\\|");
}

/** An array of repo-sourced strings, or [] for anything that is not one. */
export function flatList(value, max = 120, limit = 50) {
  if (!Array.isArray(value)) return [];
  return value.filter((v) => typeof v === "string").slice(0, limit).map((v) => flat(v, max)).filter(Boolean);
}
