import type { City, Correction, EventDetail, EventSummary, HistoricalRoute, Person, Source, Tour } from "@/lib/types";

/** All data access goes through this interface so seed JSON and Supabase are interchangeable. */
export interface AtlasRepository {
  listEvents(): Promise<EventSummary[]>;
  getEvent(id: string): Promise<EventDetail | null>;
  getSources(eventIds: string[]): Promise<Source[]>;
  listPeople(): Promise<Person[]>;
  listRoutes(): Promise<HistoricalRoute[]>;
  listTours(): Promise<Tour[]>;
  listCities(): Promise<City[]>;
  listCorrections(): Promise<Correction[]>;
}

let instance: Promise<AtlasRepository> | null = null;

export function getRepository(): Promise<AtlasRepository> {
  instance ??=
    process.env.DATA_SOURCE === "supabase"
      ? import("./supabase-repository").then((m) => m.createSupabaseRepository())
      : import("./seed-repository").then((m) => m.createSeedRepository());
  return instance;
}
