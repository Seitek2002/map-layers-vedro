import { Map as MapLibreMap, NavigationControl, ScaleControl } from "maplibre-gl";
import { useEffect, useRef } from "react";
import { useActions } from "../app/actionsContext";
import { BISHKEK, REGION } from "../config/layers";
import { useAppStore } from "../store/store";
import { attachMapController } from "./mapController";
import "./maplibreWorker";

const BASEMAP_STYLE = "https://tiles.openfreemap.org/styles/positron";
const REGION_BOUNDS: [[number, number], [number, number]] = [
  [REGION.west, REGION.south],
  [REGION.east, REGION.north],
];

/**
 * Owns the MapLibre instance for the lifetime of the component and nothing
 * else: the camera stays inside MapLibre (not in the store — panning would
 * otherwise dispatch 60 times a second), and data layers are driven by the
 * map controller, not by React renders.
 */
export function MapView() {
  const store = useAppStore();
  const actions = useActions();
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const map = new MapLibreMap({
      container,
      style: BASEMAP_STYLE,
      bounds: REGION_BOUNDS,
      fitBoundsOptions: { padding: 32 },
      pitch: 35,
      maxPitch: 70,
      attributionControl: { compact: true },
    });
    map.addControl(new NavigationControl({ visualizePitch: true }), "top-right");
    map.addControl(new ScaleControl({ unit: "metric" }), "bottom-left");
    mapRef.current = map;

    let detach: (() => void) | null = null;
    map.once("load", () => {
      detach = attachMapController(map, store, actions);
    });

    return () => {
      detach?.();
      mapRef.current = null;
      map.remove();
    };
  }, [store, actions]);

  const flyToStation = () =>
    mapRef.current?.flyTo({ center: [...BISHKEK], zoom: 17.2, pitch: 62, bearing: -30, duration: 2500 });
  const showRegion = () =>
    mapRef.current?.fitBounds(REGION_BOUNDS, { padding: 32, pitch: 35, bearing: 0, duration: 1500 });

  return (
    <div className="map-view">
      <div ref={containerRef} className="map-view__canvas" />
      <div className="map-view__camera">
        <button type="button" onClick={showRegion}>Весь регион</button>
        <button type="button" onClick={flyToStation}>3D-метеостанция</button>
      </div>
      <p className="map-view__hint">Клик по карте — ряд данных в этой точке</p>
    </div>
  );
}
