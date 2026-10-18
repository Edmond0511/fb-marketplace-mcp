// Pulls JSON values out of server-rendered HTML, where Facebook inlines Relay payloads
// inside <script> tags. A string-aware bracket scan, since titles contain brackets.

export function* jsonValuesForKey(html: string, key: string): Generator<unknown> {
  const needle = `"${key}":`;
  for (let at = html.indexOf(needle); at !== -1; at = html.indexOf(needle, at + 1)) {
    const value = readJsonValue(html, at + needle.length);
    if (value !== undefined) yield value;
  }
}

function readJsonValue(text: string, start: number): unknown {
  const open = text[start];
  if (open !== "{" && open !== "[") return undefined;
  let depth = 0;
  let inString = false;
  for (let i = start; i < text.length; i++) {
    const c = text[i];
    if (inString) {
      if (c === "\\") i++;
      else if (c === '"') inString = false;
    } else if (c === '"') {
      inString = true;
    } else if (c === "{" || c === "[") {
      depth++;
    } else if (c === "}" || c === "]") {
      depth--;
      if (depth === 0) {
        try {
          return JSON.parse(text.slice(start, i + 1));
        } catch {
          return undefined;
        }
      }
    }
  }
  return undefined;
}
