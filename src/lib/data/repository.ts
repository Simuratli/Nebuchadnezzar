import type { City, Correction, EventDetail, EventSummary, HistoricalRoute, Locale, Person, Source, Tour } from "@/lib/types";

/** All data access goes through this interface, and every method serves one language so seed JSON and Supabase are interchangeable. */
export interface AtlasRepository {
  listEvents(locale: Locale): Promise<EventSummary[]>;
  getEvent(id: string, locale: Locale): Promise<EventDetail | null>;
  getSources(eventIds: string[], locale: Locale): Promise<Source[]>;
  listPeople(locale: Locale): Promise<Person[]>;
  listRoutes(locale: Locale): Promise<HistoricalRoute[]>;
  listTours(locale: Locale): Promise<Tour[]>;
  listCities(locale: Locale): Promise<City[]>;
  listCorrections(locale: Locale): Promise<Correction[]>;
}

let instance: Promise<AtlasRepository> | null = null;

export function getRepository(): Promise<AtlasRepository> {
  instance ??=
    process.env.DATA_SOURCE === "supabase"
      ? import("./supabase-repository").then((m) => m.createSupabaseRepository())
      : import("./seed-repository").then((m) => m.createSeedRepository());
  return instance;
}
