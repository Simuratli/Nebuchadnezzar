/**
 * Loads data/seed/*.json into Supabase. Safe to re-run: rows are upserted by id.
 *
 *   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... npm run data:load-supabase
 *
 * The service role key bypasses row level security. Keep it out of the browser
 * and out of any NEXT_PUBLIC_ variable.
 */
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { citySchema, correctionSchema, eventSchema, personSchema, routeSchema, sourceSchema, tourSchema } from "../src/lib/types";

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required");
  process.exit(1);
}

const db = createClient(url, key, { auth: { persistSession: false } });
const seedDir = join(resolve(import.meta.dirname, ".."), "data", "seed");
const read = <T>(file: string, schema: z.ZodType<T>) => z.array(schema).parse(JSON.parse(readFileSync(join(seedDir, file), "utf8")));

async function upsert(table: string, rows: object[]) {
  for (let i = 0; i < rows.length; i += 200) {
    const { error } = await db.from(table).upsert(rows.slice(i, i + 200));
    if (error) throw new Error(`${table}: ${error.message}`);
  }
  console.log(`${table}: ${rows.length}`);
}

async function main() {
  // Order follows the foreign keys.
  await upsert("people", read("people.json", personSchema));
  await upsert("events", read("events.json", eventSchema));
  await upsert("sources", read("sources.json", sourceSchema));
  await upsert("routes", read("routes.json", routeSchema));
  await upsert("tours", read("tours.json", tourSchema));
  await upsert("cities", read("cities.json", citySchema));
  await upsert("corrections", read("corrections.json", correctionSchema));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
