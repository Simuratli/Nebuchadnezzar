import { setRequestLocale } from "next-intl/server";
import { AtlasLoader } from "@/components/AtlasLoader";

type Props = { params: Promise<{ locale: string }> };

export default async function Page({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <AtlasLoader />;
}
