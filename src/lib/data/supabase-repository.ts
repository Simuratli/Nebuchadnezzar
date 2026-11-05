import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { citySchema, eventSchema, personSchema, routeSchema, sourceSchema, tourSchema } from "@/lib/types";
import type { AtlasRepository } from "./repository";

const SUMMARY_COLUMNS =
  "id,title,summary,start_year,end_year,date_precision,geometry,category,region_tags,wikidata_id,image_url,content_lang,needs_review";
const PAGE_SIZE = 1000;

export function createSupabaseRepository(): AtlasRepository {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error("DATA_SOURCE=supabase requires NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY");
  const db = createClient(url, key, { auth: { persistSession: false } });
  const summarySchema = eventSchema.omit({ description: true });

  /** PostgREST caps each response, so whole tables are read page by page. */
  async function readAll<T>(table: string, columns: string, schema: z.ZodType<T>, orderBy: string): Promise<T[]> {
    const out: T[] = [];
    for (let from = 0; ; from += PAGE_SIZE) {
      const { data, error } = await db.from(table).select(columns).order(orderBy).range(from, from + PAGE_SIZE - 1);
      if (error) throw new Error(`${table}: ${error.message}`);
      out.push(...z.array(schema).parse(data));
      if ((data?.length ?? 0) < PAGE_SIZE) return out;
    }
  }

  async function getSources(eventIds: string[]) {
    const out = [];
    // Chunked because the ids travel in the request URL.
    for (let i = 0; i < eventIds.length; i += 100) {
      const { data, error } = await db.from("sources").select("*").in("event_id", eventIds.slice(i, i + 100));
      if (error) throw new Error(`sources: ${error.message}`);
      out.push(...z.array(sourceSchema).parse(data));
    }
    return out;
  }

  return {
    listEvents: () => readAll("events", SUMMARY_COLUMNS, summarySchema, "start_year"),
    async getEvent(id) {
      const { data, error } = await db.from("events").select("*").eq("id", id).maybeSingle();
      if (error) throw new Error(`events: ${error.message}`);
      if (!data) return null;
      return { ...eventSchema.parse(data), sources: await getSources([id]) };
    },
    getSources,
    listPeople: () => readAll("people", "*", personSchema, "name"),
    listRoutes: () => readAll("routes", "*", routeSchema, "start_year"),
    listTours: () => readAll("tours", "*", tourSchema, "title"),
    listCities: () => readAll("cities", "*", citySchema, "name"),
  };
}
