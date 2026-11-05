import { z } from "zod";

export const CATEGORIES = ["savas", "antlasma", "kurulus", "kultur", "bilim", "goc", "isyan", "diger"] as const;
export type Category = (typeof CATEGORIES)[number];

export const REGIONS = ["kafkasya", "osmanli", "ipek-yolu"] as const;
export type Region = (typeof REGIONS)[number];

const position = z.tuple([z.number().min(-180).max(180), z.number().min(-90).max(90)]);
export const geometrySchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("Point"), coordinates: position }),
  z.object({ type: z.literal("LineString"), coordinates: z.array(position).min(2) }),
]);

/** Years use historical numbering: negative = BCE, and there is no year 0. */
const year = z.number().int().refine((y) => y !== 0, "year 0 does not exist");

export const sourceSchema = z.object({
  id: z.string(),
  event_id: z.string(),
  type: z.enum(["birincil", "ikincil", "ansiklopedi"]),
  author: z.string().nullable(),
  title: z.string().nullable(),
  year: z.number().int().nullable(),
  publisher: z.string().nullable(),
  url: z.string().url().nullable(),
  pages: z.string().nullable(),
  reliability: z.number().int().min(1).max(3),
  accessed_at: z.string().nullable(),
  needs_review: z.boolean(),
});
export type Source = z.infer<typeof sourceSchema>;

export const eventSchema = z.object({
  id: z.string(),
  title: z.string().min(1),
  summary: z.string(),
  description: z.string(),
  start_year: year,
  end_year: year.nullable(),
  date_precision: z.enum(["year", "month", "day"]),
  geometry: geometrySchema,
  category: z.enum(CATEGORIES),
  region_tags: z.array(z.enum(REGIONS)).min(1),
  wikidata_id: z.string().nullable(),
  image_url: z.string().url().nullable(),
  /** Language of title/summary/description; anything but "tr" is flagged for review. */
  content_lang: z.string(),
  needs_review: z.boolean(),
});
export type HistoricalEvent = z.infer<typeof eventSchema>;
/** Light form sent to the client up front; `description` and sources load on demand. */
export type EventSummary = Omit<HistoricalEvent, "description">;
export type EventDetail = HistoricalEvent & { sources: Source[] };

const placeSchema = z.object({ name: z.string(), lng: z.number(), lat: z.number() });

export const personSchema = z.object({
  id: z.string(),
  name: z.string(),
  birth_year: year.nullable(),
  death_year: year.nullable(),
  wikidata_id: z.string().nullable(),
  summary: z.string(),
  description: z.string(),
  image_url: z.string().url().nullable(),
  content_lang: z.string(),
  birth_place: placeSchema.nullable(),
  death_place: placeSchema.nullable(),
  /** manual=true marks links added by hand rather than stated in Wikidata. */
  events: z.array(z.object({ event_id: z.string(), manual: z.boolean() })),
  sources: z.array(sourceSchema),
  needs_review: z.boolean(),
});
export type Person = z.infer<typeof personSchema>;

export const citySchema = z.object({
  id: z.string(),
  name: z.string(),
  wikidata_id: z.string().nullable(),
  lng: z.number(),
  lat: z.number(),
  summary: z.string(),
  content_lang: z.string(),
  /** Dated names; null means the bound is open. confirmed=true when Wikidata agrees on a boundary year. */
  periods: z.array(z.object({ name: z.string(), from: year.nullable(), to: year.nullable(), confirmed: z.boolean() })),
  other_names: z.array(z.string()),
  /** Derived by intersecting the city with boundary files, so as approximate as they are. */
  rulers: z.array(z.object({ from: year, to: year, name: z.string().nullable(), manual: z.boolean() })),
  sources: z.array(sourceSchema),
  needs_review: z.boolean(),
});
export type City = z.infer<typeof citySchema>;

export const routeSchema = z.object({
  id: z.string(),
  person_id: z.string().nullable(),
  title: z.string(),
  geometry: z.object({ type: z.literal("LineString"), coordinates: z.array(position).min(2) }),
  start_year: year,
  end_year: year,
  waypoints: z
    .array(z.object({ year, lng: z.number(), lat: z.number(), place: z.string(), note: z.string() }))
    .min(2),
  needs_review: z.boolean(),
});
export type HistoricalRoute = z.infer<typeof routeSchema>;

export const tourStepSchema = z.object({
  title: z.string(),
  text: z.string(),
  year,
  event_id: z.string().nullable(),
  view: z.object({ lng: z.number(), lat: z.number(), zoom: z.number() }),
});
export const tourSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string(),
  steps: z.array(tourStepSchema).min(1),
  needs_review: z.boolean(),
});
export type Tour = z.infer<typeof tourSchema>;
export type TourStep = z.infer<typeof tourStepSchema>;
