// MapLibre v6 ships its worker as a separate ES module that webpack does not bundle.
// It is served from /public so the version always matches the installed package.
import { copyFileSync } from "node:fs";

copyFileSync("node_modules/maplibre-gl/dist/maplibre-gl-worker.mjs", "public/maplibre-gl-worker.mjs");
