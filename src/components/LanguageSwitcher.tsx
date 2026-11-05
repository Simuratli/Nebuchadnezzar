"use client";

import { useLocale, useTranslations } from "next-intl";
import { LOCALES, type Locale } from "@/lib/types";

// Each language is named in itself, so people can find their own in any interface.
const NAMES: Record<Locale, string> = { en: "English", tr: "Türkçe", az: "Azərbaycanca" };

export function LanguageSwitcher() {
  const t = useTranslations("app");
  const locale = useLocale();
  return (
    <select
      aria-label={t("language")}
      value={locale}
      data-testid="language"
      // A full navigation reloads the data in the new language; the query keeps the view.
      onChange={(e) => window.location.assign(`/${e.target.value}${window.location.search}`)}
      className="rounded-lg bg-transparent px-1.5 py-1.5 text-[13px] font-medium text-ink hover:bg-surface-2"
    >
      {LOCALES.map((l) => (
        <option key={l} value={l} lang={l}>
          {NAMES[l]}
        </option>
      ))}
    </select>
  );
}
