import { Marker, type Map as MapLibreMap, type MapMouseEvent } from "maplibre-gl";
import { BISHKEK, LAYER_ORDER, LAYERS, REGION, type LayerId } from "../config/layers";
import { cellAt } from "../domain/grid";
import { windBearing, windSpeed } from "../domain/layer";
import type { AppActions } from "../store/actions";
import { selectLayerFrame } from "../store/selectors";
import type { AppState } from "../store/state";
import { subscribe, type AppStore } from "../store/store";
import { createRenderer, type LayerRenderer } from "./renderers";
import type { StationWind, WeatherStation } from "./station/weatherStation";

function addRegionOutline(map: MapLibreMap, beforeId: string | undefined): void {
  const { west, south, east, north } = REGION;
  map.addSource("region", {
    type: "geojson",
    data: {
      type: "Feature",
      properties: {},
      geometry: {
        type: "LineString",
        coordinates: [[west, south], [east, south], [east, north], [west, north], [west, south]],
      },
    },
  });
  map.addLayer(
    { id: "region-outline", type: "line", source: "region", paint: { "line-color": "#334", "line-width": 1, "line-dasharray": [3, 3], "line-opacity": 0.5 } },
    beforeId,
  );
}

function addBuildings3d(map: MapLibreMap, beforeId: string | undefined): void {
  if (!map.getSource("openmaptiles")) return;
  map.addLayer(
    {
      id: "buildings-3d",
      type: "fill-extrusion",
      source: "openmaptiles",
      "source-layer": "building",
      minzoom: 13,
      paint: {
        "fill-extrusion-color": "#d6d9de",
        "fill-extrusion-height": ["coalesce", ["get", "render_height"], 8],
        "fill-extrusion-base": ["coalesce", ["get", "render_min_height"], 0],
        "fill-extrusion-opacity": 0.85,
      },
    },
    beforeId,
  );
}

function stationWind(state: AppState): StationWind | null {
  if (!state.layers.wind.enabled) return null;
  const frame = selectLayerFrame(state, "wind");
  if (frame?.status !== "success" || frame.data.kind !== "vector") return null;
  const cell = cellAt(LAYERS.wind.grid, BISHKEK);
  if (cell === null) return null;
  const u = frame.data.u[cell] ?? 0;
  const v = frame.data.v[cell] ?? 0;
  return { speed: windSpeed(u, v), bearing: windBearing(u, v) };
}

/**
 * The React ↔ MapLibre boundary. MapLibre is imperative and owns its own
 * render loop, so layers are *not* rendered through React: this controller
 * subscribes to the store directly, coalesces changes to one sync per
 * animation frame and pushes the minimal diff into the map. React only mounts
 * the container.
 */
export function attachMapController(map: MapLibreMap, store: AppStore, actions: AppActions): () => void {
  const renderers = new Map<LayerId, LayerRenderer>();
  const labelsId = map.getStyle().layers.find((layer) => layer.type === "symbol")?.id;
  let probeMarker: Marker | null = null;
  let station: WeatherStation | null = null;
  let frameRequested = 0;
  let destroyed = false;

  addBuildings3d(map, labelsId);
  // Data goes under 3D buildings and the basemap's labels, so place names stay
  // readable and the city isn't washed over by a 40 km weather cell.
  const dataCeilingId = map.getLayer("buildings-3d") ? "buildings-3d" : labelsId;
  addRegionOutline(map, dataCeilingId);

  /** Insert beneath the next mounted layer in draw order, so toggling never shuffles z-order. */
  function beforeIdFor(id: LayerId): string | undefined {
    const later = LAYER_ORDER.slice(LAYER_ORDER.indexOf(id) + 1);
    for (const next of later) {
      const renderer = renderers.get(next);
      if (renderer) return renderer.bottomLayerId;
    }
    return dataCeilingId;
  }

  function syncLayer(state: AppState, id: LayerId): void {
    const settings = state.layers[id];
    let renderer = renderers.get(id);

    if (!settings.enabled) {
      renderer?.destroy();
      renderers.delete(id);
      return;
    }
    if (!renderer) {
      renderer = createRenderer(map, LAYERS[id], beforeIdFor(id));
      renderers.set(id, renderer);
    }

    renderer.setOpacity(settings.opacity);
    const frame = selectLayerFrame(state, id);
    if (frame === null) {
      renderer.setFrame(null);
      return;
    }
    // Stale-while-loading: keep the previous frame on screen (dimmed) until
    // the new one arrives, then tween into it — no blank flashes while scrubbing.
    renderer.setStale(frame?.status !== "success");
    if (frame?.status === "success") renderer.setFrame(frame.data);
  }

  function syncProbe(state: AppState): void {
    if (!state.probe) {
      probeMarker?.remove();
      probeMarker = null;
      return;
    }
    const [lng, lat] = state.probe.lngLat;
    if (!probeMarker) probeMarker = new Marker({ color: "#1d3557" }).setLngLat([lng, lat]).addTo(map);
    else probeMarker.setLngLat([lng, lat]);
  }

  function sync(): void {
    frameRequested = 0;
    if (destroyed) return;
    const state = store.get();
    for (const id of LAYER_ORDER) syncLayer(state, id);
    syncProbe(state);
    station?.setWind(stationWind(state));
  }

  function scheduleSync(): void {
    if (frameRequested || destroyed) return;
    frameRequested = requestAnimationFrame(sync);
  }

  const onClick = (event: MapMouseEvent) => actions.setProbe([event.lngLat.lng, event.lngLat.lat]);
  map.on("click", onClick);
  const unsubscribe = subscribe(store, scheduleSync);

  void import("./station/weatherStation").then(({ createWeatherStation }) => {
    if (destroyed) return;
    station = createWeatherStation(BISHKEK);
    map.addLayer(station.layer);
    scheduleSync();
  });

  return () => {
    destroyed = true;
    cancelAnimationFrame(frameRequested);
    unsubscribe();
    map.off("click", onClick);
    probeMarker?.remove();
    renderers.forEach((renderer) => renderer.destroy());
    renderers.clear();
  };
}
