import { NextResponse } from "next/server";
import { getRepository } from "@/lib/data/repository";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[\w-]{1,64}$/.test(id)) return NextResponse.json({ error: "invalid id" }, { status: 400 });
  const repository = await getRepository();
  const event = await repository.getEvent(id);
  if (!event) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json(event);
}
