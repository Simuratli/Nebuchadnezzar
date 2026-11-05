import { NextResponse } from "next/server";
import { z } from "zod";
import { getRepository } from "@/lib/data/repository";
import { asLocale } from "@/lib/types";

const bodySchema = z.object({ eventIds: z.array(z.string().regex(/^[\w-]{1,64}$/)).max(2000), locale: z.string().optional() });

// POST because a large collection's id list would not fit in a query string.
export async function POST(request: Request) {
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid body" }, { status: 400 });
  const repository = await getRepository();
  return NextResponse.json(await repository.getSources(parsed.data.eventIds, asLocale(parsed.data.locale)));
}
