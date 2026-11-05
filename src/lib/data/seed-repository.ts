import citiesJson from "../../../data/seed/cities.json";
import eventsJson from "../../../data/seed/events.json";
import peopleJson from "../../../data/seed/people.json";
import routesJson from "../../../data/seed/routes.json";
import sourcesJson from "../../../data/seed/sources.json";
import toursJson from "../../../data/seed/tours.json";
import type { City, EventSummary, HistoricalEvent, HistoricalRoute, Person, Source, Tour } from "@/lib/types";
import type { AtlasRepository } from "./repository";

export function createSeedRepository(): AtlasRepository {
  const events = eventsJson as HistoricalEvent[];
  const sources = sourcesJson as Source[];
  const byId = new Map(events.map((e) => [e.id, e]));

  return {
    async listEvents() {
      return events.map((event): EventSummary => {
        const { description: _omit, ...summary } = event;
        return summary;
      });
    },
    async getEvent(id) {
      const event = byId.get(id);
      return event ? { ...event, sources: sources.filter((s) => s.event_id === id) } : null;
    },
    async getSources(eventIds) {
      const wanted = new Set(eventIds);
      return sources.filter((s) => wanted.has(s.event_id));
    },
    async listPeople() {
      return peopleJson as Person[];
    },
    async listRoutes() {
      return routesJson as HistoricalRoute[];
    },
    async listTours() {
      return toursJson as Tour[];
    },
    async listCities() {
      return citiesJson as City[];
    },
  };
}
