import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import {
  correctionSchema,
  routeSchema,
  sourceSchema,
  storedCitySchema,
  storedEventSchema,
  storedPersonSchema,
  tourSchema,
  type Locale,
  type Source,
} from "@/lib/types";
import { localizeCity, localizeCorrection, localizeEvent, localizePerson, localizeRoute, localizeSources, localizeTour } from "./localize";
import type { AtlasRepository } from "./repository";

const PAGE_SIZE = 1000;

export function createSupabaseRepository(): AtlasRepository {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error("DATA_SOURCE=supabase requires NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY");
  const db = createClient(url, key, { auth: { persistSession: false } });

  /** PostgREST caps each response, so whole tables are read page by page. */
  async function readAll<S extends z.ZodType>(table: string, schema: S, orderBy: string): Promise<z.output<S>[]> {
    const out: z.output<S>[] = [];
    for (let from = 0; ; from += PAGE_SIZE) {
      const { data, error } = await db.from(table).select("*").order(orderBy).range(from, from + PAGE_SIZE - 1);
      if (error) throw new Error(`${table}: ${error.message}`);
      out.push(...z.array(schema).parse(data));
      if ((data?.length ?? 0) < PAGE_SIZE) return out;
    }
  }

  async function readSources(eventIds: string[]): Promise<Source[]> {
    const out: Source[] = [];
    // Chunked because the ids travel in the request URL.
    for (let i = 0; i < eventIds.length; i += 100) {
      const { data, error } = await db.from("sources").select("*").in("event_id", eventIds.slice(i, i + 100));
      if (error) throw new Error(`sources: ${error.message}`);
      out.push(...z.array(sourceSchema).parse(data));
    }
    return out;
  }

  async function getSources(eventIds: string[], locale: Locale) {
    const sources = await readSources(eventIds);
    return [...new Set(sources.map((s) => s.event_id))].flatMap((id) => localizeSources(sources.filter((s) => s.event_id === id), locale, ""));
  }

  return {
    async listEvents(locale) {
      const events = await readAll("events", storedEventSchema, "start_year");
      return events.map((e) => {
        const { description: _omit, ...summary } = localizeEvent(e, locale);
        return summary;
      });
    },
    async getEvent(id, locale) {
      const { data, error } = await db.from("events").select("*").eq("id", id).maybeSingle();
      if (error) throw new Error(`events: ${error.message}`);
      if (!data) return null;
      const event = localizeEvent(storedEventSchema.parse(data), locale);
      return { ...event, sources: localizeSources(await readSources([id]), locale, event.title) };
    },
    getSources,
    async listPeople(locale) {
      return (await readAll("people", storedPersonSchema, "id")).map((p) => localizePerson(p, locale));
    },
    async listRoutes(locale) {
      return (await readAll("routes", routeSchema, "start_year")).map((r) => localizeRoute(r, locale));
    },
    async listTours(locale) {
      return (await readAll("tours", tourSchema, "title")).map((t) => localizeTour(t, locale));
    },
    async listCities(locale) {
      return (await readAll("cities", storedCitySchema, "id")).map((c) => localizeCity(c, locale));
    },
    async listCorrections(locale) {
      return (await readAll("corrections", correctionSchema, "id")).map((c) => localizeCorrection(c, locale));
    },
  };
}
