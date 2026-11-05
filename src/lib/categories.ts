import type { Category } from "./types";

/** Marker colour and a 24×24 SVG path, shared by the map icons and the UI legend. */
export const CATEGORY_META: Record<Category, { color: string; icon: string }> = {
  savas: { color: "#a4331f", icon: "M5 3l9 9-2 2-9-9V3h2zm14 0h2v2l-7.5 7.5-2-2L19 3zM7 15l2 2-3 3 1 1-1.5 1.5L3 20l-1-1 1.5-1.5 1 1 2.5-3.5zm10 0l2.5 3.5 1-1L22 19l-1 1-2.5 2.5L17 21l1-1-3-3 2-2z" },
  antlasma: { color: "#2f6b8f", icon: "M6 2h9l5 5v15H6V2zm8 1.5V8h4.5L14 3.5zM9 11v1.8h8V11H9zm0 4v1.8h8V15H9z" },
  kurulus: { color: "#7a5a23", icon: "M3 21V10l4-3v3l4-3v3l4-3V3h6v18H3zm4-3h2.5v-3H7v3zm5 0h2.5v-3H12v3zm5 0h2v-3h-2v3z" },
  kultur: { color: "#7c3f8c", icon: "M12 2l10 5v2H2V7l10-5zM4 10.5h3V18H4v-7.5zm6.5 0h3V18h-3v-7.5zm6.5 0h3V18h-3v-7.5zM2 19.5h20V22H2v-2.5z" },
  bilim: { color: "#1f7a63", icon: "M9 2h6v2h-1v5.5l5.6 9.3A2.1 2.1 0 0117.8 22H6.2a2.1 2.1 0 01-1.8-3.2L10 9.5V4H9V2zm-.4 13h6.8l-2.4-4h-2l-2.4 4z" },
  goc: { color: "#b8691c", icon: "M2 11h13V6l7 6-7 6v-5H2v-2z" },
  isyan: { color: "#b02a58", icon: "M5 2h2v1h13l-3.5 5L20 13H7v9H5V2z" },
  diger: { color: "#5b6168", icon: "M12 4a8 8 0 100 16 8 8 0 000-16z" },
};

export const iconImageId = (category: Category) => `cat-${category}`;
