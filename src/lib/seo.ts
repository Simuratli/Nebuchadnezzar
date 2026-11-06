import type { Metadata } from "next";
import { DEFAULT_LOCALE, LOCALES, type Locale } from "./types";

/** Set NEXT_PUBLIC_SITE_URL in production: canonical links and the sitemap are built from it. */
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000").replace(/\/+$/, "");

export const localizedUrl = (locale: Locale, path = "") => `${SITE_URL}/${locale}${path}`;

/**
 * Canonical and hreflang links for a page. Only languages that really have this page's
 * text are offered, so a page showing fallback text is never presented as a translation.
 */
export function alternates(locale: Locale, path = "", languages: readonly Locale[] = LOCALES): NonNullable<Metadata["alternates"]> {
  const entries = languages.map((l) => [l, localizedUrl(l, path)] as const);
  const xDefault = languages.includes(DEFAULT_LOCALE) ? DEFAULT_LOCALE : languages[0];
  return {
    canonical: localizedUrl(locale, path),
    languages: { ...Object.fromEntries(entries), ...(xDefault ? { "x-default": localizedUrl(xDefault, path) } : {}) },
  };
}

/** A search snippet: whole words, single line, at most `max` characters. */
export function snippet(text: string, max = 155): string {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max);
  const space = cut.lastIndexOf(" ");
  return `${(space > 0 ? cut.slice(0, space) : cut).replace(/[.,;:—–-]+$/, "")}…`;
}

/** Serializes structured data for a script tag. Escaping "<" stops text from closing the tag. */
export const jsonLd = (data: object) => JSON.stringify(data).replace(/</g, "\\u003c");
