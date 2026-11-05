import { defineRouting } from "next-intl/routing";

// Add "az" and "en" here (plus messages/<locale>.json) when translations are ready.
export const routing = defineRouting({
  locales: ["tr"],
  defaultLocale: "tr",
  localePrefix: "always",
});
