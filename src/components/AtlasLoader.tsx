"use client";

import dynamic from "next/dynamic";
import { useTranslations } from "next-intl";
import type { AtlasData } from "./AtlasApp";

function Loading() {
  const t = useTranslations("app");
  return (
    <div role="status" className="flex h-dvh items-center justify-center font-serif text-lg text-muted">
      {t("loading")}
    </div>
  );
}

// The app is map-driven and reads its initial state from the URL, so it renders on the client only.
const AtlasApp = dynamic(() => import("./AtlasApp").then((m) => m.AtlasApp), { ssr: false, loading: Loading });

export function AtlasLoader({ data }: { data: AtlasData }) {
  return <AtlasApp data={data} />;
}
