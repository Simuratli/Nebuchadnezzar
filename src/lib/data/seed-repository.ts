import citiesJson from "../../../data/seed/cities.json";
import correctionsJson from "../../../data/seed/corrections.json";
import eventsJson from "../../../data/seed/events.json";
import peopleJson from "../../../data/seed/people.json";
import routesJson from "../../../data/seed/routes.json";
import sourcesJson from "../../../data/seed/sources.json";
import toursJson from "../../../data/seed/tours.json";
import type { Correction, EventSummary, HistoricalRoute, Source, StoredCity, StoredEvent, StoredPerson, Tour } from "@/lib/types";
import { localizeCity, localizeCorrection, localizeEvent, localizePerson, localizeRoute, localizeSources, localizeTour } from "./localize";
import type { AtlasRepository } from "./repository";

export function createSeedRepository(): AtlasRepository {
  const events = eventsJson as unknown as StoredEvent[];
  const sources = sourcesJson as unknown as Source[];
  const byId = new Map(events.map((e) => [e.id, e]));

  return {
    async listEvents(locale) {
      return events.map((event): EventSummary => {
        const { description: _omit, ...summary } = localizeEvent(event, locale);
        return summary;
      });
    },
    async getEvent(id, locale) {
      const event = byId.get(id);
      if (!event) return null;
      const localized = localizeEvent(event, locale);
      return { ...localized, sources: localizeSources(sources.filter((s) => s.event_id === id), locale, localized.title) };
    },
    async getSources(eventIds, locale) {
      return eventIds.flatMap((id) => {
        const event = byId.get(id);
        return event ? localizeSources(sources.filter((s) => s.event_id === id), locale, localizeEvent(event, locale).title) : [];
      });
    },
    async listPeople(locale) {
      return (peopleJson as unknown as StoredPerson[]).map((p) => localizePerson(p, locale));
    },
    async listRoutes(locale) {
      return (routesJson as unknown as HistoricalRoute[]).map((r) => localizeRoute(r, locale));
    },
    async listTours(locale) {
      return (toursJson as unknown as Tour[]).map((t) => localizeTour(t, locale));
    },
    async listCities(locale) {
      return (citiesJson as unknown as StoredCity[]).map((c) => localizeCity(c, locale));
    },
    async listCorrections(locale) {
      return (correctionsJson as unknown as Correction[]).map((c) => localizeCorrection(c, locale));
    },
  };
}
