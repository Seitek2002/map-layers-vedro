import { setWorkerUrl } from "maplibre-gl";
import workerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url";

// MapLibre 6 locates its worker with `new URL(name, import.meta.url)` using a
// variable name — Vite can neither pre-bundle that in dev nor emit it in the
// production build. Bundling it as a Vite worker and handing MapLibre the URL
// makes both work. Imported for its side effect before any map is created.
setWorkerUrl(workerUrl);
