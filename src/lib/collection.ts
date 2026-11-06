import { z } from "zod";

export const collectionItemSchema = z.object({
  eventId: z.string(),
  note: z.string(),
  addedAt: z.string(),
});
export type CollectionItem = z.infer<typeof collectionItemSchema>;

/** Storage boundary: swap in a Supabase-backed implementation when accounts arrive. */
export interface CollectionStore {
  load(): CollectionItem[];
  save(items: CollectionItem[]): void;
}

// Keeps the name from before the rename, so collections already in browsers survive.
const KEY = "zaman-atlasi:collection:v1";

type StorageLike = Pick<Storage, "getItem" | "setItem">;

export function createLocalCollectionStore(storage: StorageLike | null): CollectionStore {
  return {
    load() {
      try {
        const raw = storage?.getItem(KEY);
        // Corrupt or outdated data must not stop the app from starting.
        const parsed = z.array(collectionItemSchema).safeParse(raw ? JSON.parse(raw) : []);
        return parsed.success ? parsed.data : [];
      } catch {
        return [];
      }
    },
    save(items) {
      try {
        storage?.setItem(KEY, JSON.stringify(items));
      } catch {
        // Storage can be full or blocked; the collection then lasts for this session only.
      }
    },
  };
}
