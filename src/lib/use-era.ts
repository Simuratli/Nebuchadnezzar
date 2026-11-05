import { useTranslations } from "next-intl";
import type { Era } from "./year";

/** The current language's era labels, such as "331 BCE" or "MÖ 331". */
export function useEra(): Era {
  const t = useTranslations("era");
  return { bc: t("bc"), ad: t("ad"), suffix: t("position") === "suffix" };
}
