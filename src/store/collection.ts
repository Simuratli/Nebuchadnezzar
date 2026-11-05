import { create } from "zustand";
import { createLocalCollectionStore, type CollectionItem } from "@/lib/collection";

const backend = createLocalCollectionStore(typeof window === "undefined" ? null : safeStorage());

function safeStorage(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null; // blocked by browser privacy settings
  }
}

type CollectionState = {
  items: CollectionItem[];
  add: (eventId: string) => void;
  remove: (eventId: string) => void;
  setNote: (eventId: string, note: string) => void;
};

export const useCollection = create<CollectionState>((set, get) => {
  const commit = (items: CollectionItem[]) => {
    set({ items });
    backend.save(items);
  };
  return {
    items: backend.load(),
    add: (eventId) => {
      if (!get().items.some((i) => i.eventId === eventId)) {
        commit([...get().items, { eventId, note: "", addedAt: new Date().toISOString() }]);
      }
    },
    remove: (eventId) => commit(get().items.filter((i) => i.eventId !== eventId)),
    setNote: (eventId, note) => commit(get().items.map((i) => (i.eventId === eventId ? { ...i, note } : i))),
  };
});
