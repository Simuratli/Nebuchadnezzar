import type { Metadata, Viewport } from "next";
import { Inter, Source_Serif_4 } from "next/font/google";
import { notFound } from "next/navigation";
import { hasLocale, NextIntlClientProvider } from "next-intl";
import { getMessages, getTranslations, setRequestLocale } from "next-intl/server";
import { ThemeProvider } from "next-themes";
import { routing } from "@/i18n/routing";
import { alternates, SITE_URL } from "@/lib/seo";
import { asLocale } from "@/lib/types";
import "../globals.css";

// latin-ext covers Turkish (ı, ş, ğ) and Azerbaijani (ə).
const serif = Source_Serif_4({ subsets: ["latin", "latin-ext"], variable: "--font-source-serif", display: "swap" });
const sans = Inter({ subsets: ["latin", "latin-ext"], variable: "--font-inter", display: "swap" });

type Props = { children: React.ReactNode; params: Promise<{ locale: string }> };

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale });
  const brand = t("app.title");
  const description = t("seo.homeDescription");
  const title = `${t("seo.homeTitle")} | ${brand}`;
  return {
    metadataBase: new URL(SITE_URL),
    title: { default: title, template: `%s | ${brand}` },
    description,
    applicationName: brand,
    icons: { icon: "/favicon.svg" },
    verification: { google: "LYxCfyRNBX2i-yNHpLKuCDilh4TDTGwERTWjzq2rPc4" },
    alternates: alternates(asLocale(locale)),
    openGraph: { type: "website", siteName: brand, title, description, locale, url: `/${locale}`, images: [{ url: "/og.png", width: 1200, height: 630, alt: brand }] },
    twitter: { card: "summary_large_image", title, description, images: ["/og.png"] },
  };
}

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#e9edf1" },
    { media: "(prefers-color-scheme: dark)", color: "#0e141b" },
  ],
};

export default async function LocaleLayout({ children, params }: Props) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const messages = await getMessages();
  return (
    <html lang={locale} className={`${serif.variable} ${sans.variable}`} suppressHydrationWarning>
      <body>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          <NextIntlClientProvider locale={locale} messages={messages}>
            {children}
          </NextIntlClientProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
