import { create } from "zustand";
import { EMPTY_FILTERS, type Filters } from "@/lib/filters";
import type { EventSummary } from "@/lib/types";
import { DEFAULT_URL_STATE, parseUrlState, type UrlState } from "@/lib/url-state";
import { clampYear, isVisibleAt } from "@/lib/year";

export const SPEEDS = [5, 10, 25, 50, 100] as const;
export const WINDOWS = [0, 10, 25, 50, 100] as const;

export type FlyTarget = { lng: number; lat: number; zoom?: number; nonce: number };
export type SidePanel = "filters" | "collection" | "routes" | "tours" | "export" | null;

type AtlasState = UrlState & {
  playing: boolean;
  speed: number;
  windowYears: number;
  flyTarget: FlyTarget | null;
  filters: Filters;
  sidePanel: SidePanel;
  tourStep: number;
  /** Bumped to restart the route animation. */
  routeNonce: number;
  setYear: (year: number) => void;
  setYear2: (year: number) => void;
  setPlaying: (playing: boolean) => void;
  setSpeed: (speed: number) => void;
  setWindowYears: (windowYears: number) => void;
  setView: (view: { lng: number; lat: number; zoom: number }) => void;
  flyTo: (target: { lng: number; lat: number; zoom?: number }) => void;
  selectEvent: (id: string | null) => void;
  selectPerson: (id: string | null) => void;
  selectCity: (id: string | null) => void;
  /** Selects an event from a list: moves the slider to it if needed and flies there. */
  openEvent: (event: EventSummary) => void;
  setFilters: (filters: Partial<Filters>) => void;
  clearFilters: () => void;
  setSidePanel: (panel: SidePanel) => void;
  setCompare: (compare: boolean) => void;
  setRoute: (routeId: string | null) => void;
  replayRoute: () => void;
  startTour: (tourId: string) => void;
  setTourStep: (step: number) => void;
  endTour: () => void;
};

const initial = typeof window === "undefined" ? DEFAULT_URL_STATE : parseUrlState(window.location.search);

export const useAtlas = create<AtlasState>((set, get) => ({
  ...initial,
  playing: false,
  speed: 25,
  windowYears: 25,
  flyTarget: null,
  filters: EMPTY_FILTERS,
  sidePanel: null,
  tourStep: 0,
  routeNonce: 0,
  setYear: (year) => set({ year: clampYear(year) }),
  setYear2: (year2) => set({ year2: clampYear(year2) }),
  setPlaying: (playing) => set({ playing }),
  setSpeed: (speed) => set({ speed }),
  setWindowYears: (windowYears) => set({ windowYears }),
  setView: ({ lng, lat, zoom }) => set({ lng, lat, zoom }),
  flyTo: (target) => set({ flyTarget: { ...target, nonce: Date.now() + Math.random() } }),
  // Only one detail panel is open at a time.
  selectEvent: (eventId) => set({ eventId, personId: null, cityId: null }),
  selectPerson: (personId) => set({ personId, eventId: null, cityId: null }),
  selectCity: (cityId) => set({ cityId, eventId: null, personId: null }),
  openEvent: (event) => {
    const { year, windowYears, flyTo } = get();
    const [lng, lat] = event.geometry.type === "Point" ? event.geometry.coordinates : event.geometry.coordinates[0];
    set({
      eventId: event.id,
      personId: null,
      cityId: null,
      playing: false,
      // Keep the current year when the event is already on the map.
      year: isVisibleAt(event.start_year, event.end_year, year, windowYears) ? year : clampYear(event.start_year),
    });
    flyTo({ lng, lat });
  },
  setFilters: (filters) => set((s) => ({ filters: { ...s.filters, ...filters } })),
  clearFilters: () => set({ filters: EMPTY_FILTERS }),
  setSidePanel: (sidePanel) => set({ sidePanel }),
  setCompare: (compare) => set({ compare, playing: false }),
  setRoute: (routeId) => set({ routeId, playing: false }),
  replayRoute: () => set((s) => ({ routeNonce: s.routeNonce + 1, playing: false })),
  startTour: (tourId) => set({ tourId, tourStep: 0, playing: false, routeId: null, compare: false, sidePanel: null, eventId: null, personId: null, cityId: null }),
  setTourStep: (tourStep) => set({ tourStep }),
  endTour: () => set({ tourId: null, tourStep: 0 }),
}));
