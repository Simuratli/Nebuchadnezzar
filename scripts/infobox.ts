/** Pure helpers that read fields out of Wikipedia infobox wikitext. Used by scripts/fetch-cards.ts. */

export type InfoboxFields = Record<string, string>;

/** Finds a conflict or treaty infobox and returns its fields, or null if the page has none. */
export function extractInfobox(wikitext: string): InfoboxFields | null {
  const start = wikitext.search(/\{\{\s*Infobox[ _](military conflict|civil conflict|military operation|treaty)/i);
  if (start < 0) return null;

  let depth = 0;
  let end = -1;
  for (let i = start; i < wikitext.length - 1; i++) {
    const pair = wikitext.slice(i, i + 2);
    if (pair === "{{") {
      depth++;
      i++;
    } else if (pair === "}}") {
      depth--;
      i++;
      if (depth === 0) {
        end = i - 1;
        break;
      }
    }
  }
  if (end < 0) return null;

  const body = wikitext.slice(start + 2, end);
  const parts: string[] = [];
  let current = "";
  let nest = 0;
  for (let i = 0; i < body.length; i++) {
    const pair = body.slice(i, i + 2);
    if (pair === "{{" || pair === "[[") {
      nest++;
      current += pair;
      i++;
    } else if (pair === "}}" || pair === "]]") {
      nest--;
      current += pair;
      i++;
    } else if (body[i] === "|" && nest === 0) {
      parts.push(current);
      current = "";
    } else {
      current += body[i];
    }
  }
  parts.push(current);

  const fields: InfoboxFields = {};
  for (const part of parts.slice(1)) {
    const eq = part.indexOf("=");
    if (eq < 0) continue;
    const key = part.slice(0, eq).trim().toLowerCase();
    const value = part.slice(eq + 1).trim();
    if (key && value) fields[key] = value;
  }
  return fields;
}

const LIST_TEMPLATES = /^(plainlist|plain list|flatlist|flat list|ubl|unbulleted list|ublist|hlist|collapsible list|bulleted list|ordered list)$/i;
const TEXT_TEMPLATES = /^(nowrap|nobold|small|smaller|big|lang|transl|transliteration|avoid wrap)$/i;
const FLAG_TEMPLATES = /^(flag|flagcountry|flagu|flag country|flagdeco country)$/i;

/** Splits template arguments on pipes, leaving the pipe inside a [[Target|label]] link alone. */
function splitArgs(inner: string): string[] {
  const parts: string[] = [];
  let current = "";
  let links = 0;
  for (let i = 0; i < inner.length; i++) {
    const pair = inner.slice(i, i + 2);
    if (pair === "[[" || pair === "]]") {
      links += pair === "[[" ? 1 : -1;
      current += pair;
      i++;
    } else if (inner[i] === "|" && links === 0) {
      parts.push(current);
      current = "";
    } else {
      current += inner[i];
    }
  }
  parts.push(current);
  return parts;
}

/** Resolves templates from the inside out: flags become links, lists become lines, the rest goes. */
function resolveTemplates(text: string): string {
  let out = text;
  for (let pass = 0; pass < 12 && out.includes("{{"); pass++) {
    const next = out.replace(/\{\{([^{}]*)\}\}/g, (_match, inner: string) => {
      const [rawName, ...args] = splitArgs(inner);
      const name = rawName.trim();
      const positional = args.filter((a) => !/^\s*\w+\s*=/.test(a)).map((a) => a.trim());
      if (FLAG_TEMPLATES.test(name)) return positional[0] ? `[[${positional[0]}]]` : "";
      if (LIST_TEMPLATES.test(name)) return positional.join("\n");
      if (TEXT_TEMPLATES.test(name)) return positional[positional.length - 1] ?? "";
      return "";
    });
    if (next === out) break;
    out = next;
  }
  return out;
}

function stripMarkup(text: string): string {
  return text
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<ref\b[^>]*\/>/gi, "")
    .replace(/<ref\b[\s\S]*?<\/ref>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "");
}

// A leading colon marks a link to another wiki or namespace, not an article of this one.
const SKIP_LINK = /^(:|file:|image:|category:|wikt:|wiktionary:|s:)/i;

/** Linked page titles in a field, in order and without duplicates. */
export function linkTargets(value: string, limit = 6): string[] {
  const text = resolveTemplates(stripMarkup(value));
  const out: string[] = [];
  for (const m of text.matchAll(/\[\[([^\]|#]+)(?:#[^\]|]*)?(?:\|[^\]]*)?\]\]/g)) {
    const title = m[1].trim();
    if (title && !SKIP_LINK.test(title) && !out.includes(title)) out.push(title);
    if (out.length >= limit) break;
  }
  return out;
}

/** The result field as one short line. Pointers such as "see Aftermath" carry no information. */
export function cleanResult(value: string | undefined, max = 160): string | null {
  if (!value) return null;
  const text = resolveTemplates(stripMarkup(value))
    .replace(/\[\[(?:[^\]|]*\|)?([^\]]*)\]\]/g, "$1")
    .replace(/'{2,}/g, "")
    .split("\n")
    .map((l) => l.replace(/^[*#:\s]+/, "").trim())
    .filter(Boolean)
    .join("; ")
    .replace(/\s+/g, " ")
    .trim();
  if (!text || /^(see\b|disputed$|\?)/i.test(text) || /\bsee\s+(the\s+)?(§|aftermath|below|section)/i.test(text)) return null;
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  return `${cut.slice(0, cut.lastIndexOf(" "))}…`;
}

export type InfoboxSides = { parties: string[]; commanders: string[] }[];

/** Reads numbered combatant and commander fields; a side needs at least one named party or leader. */
export function readSides(fields: InfoboxFields): InfoboxSides {
  const sides: InfoboxSides = [];
  for (const n of [1, 2, 3]) {
    const parties = linkTargets(fields[`combatant${n}`] ?? fields[`side${n}`] ?? "");
    const commanders = linkTargets(fields[`commander${n}`] ?? fields[`leader${n}`] ?? "");
    if (parties.length || commanders.length) sides.push({ parties, commanders });
  }
  return sides;
}
