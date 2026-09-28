import type { Feature, Point } from "geojson";
import type { GeoJSONSource, Map as MapLibreMap } from "maplibre-gl";
import type { LayerId } from "../../config/layers";
import { cellCenter, cellCount } from "../../domain/grid";
import { windBearing, windSpeed, type LayerDefinition, type LayerFrame } from "../../domain/layer";
import { animate, lerpInto } from "../tween";
import { rampExpression } from "./scalarRenderer";
import { createOpacityState, FRAME_TWEEN_MS, OPACITY_TRANSITION, type LayerRenderer } from "./types";

type VectorLayerDefinition = Extract<LayerDefinition<LayerId>, { kind: "vectors" }>;

const ARROW_IMAGE = "wind-arrow";

/** North-pointing arrow drawn once into an SDF image, so `icon-color` can tint it by speed. */
function ensureArrowImage(map: MapLibreMap): void {
  if (map.hasImage(ARROW_IMAGE)) return;
  const size = 64;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.fillStyle = "#fff";
  ctx.beginPath();
  ctx.moveTo(32, 4);
  ctx.lineTo(50, 28);
  ctx.lineTo(37, 28);
  ctx.lineTo(37, 60);
  ctx.lineTo(27, 60);
  ctx.lineTo(27, 28);
  ctx.lineTo(14, 28);
  ctx.closePath();
  ctx.fill();
  map.addImage(ARROW_IMAGE, ctx.getImageData(0, 0, size, size), { sdf: true, pixelRatio: 2 });
}

/**
 * Wind arrows. Rotation is a layout property, which feature-state can't
 * drive, so this renderer re-sends the (small, ~60 point) GeoJSON on each
 * tween frame. It interpolates u/v components rather than angles, so a turn
 * from 350° to 10° goes the short way round instead of spinning back.
 */
export function createVectorRenderer(
  map: MapLibreMap,
  def: VectorLayerDefinition,
  beforeId: string | undefined,
): LayerRenderer {
  const sourceId = `data-${def.id}`;
  const layerId = `data-${def.id}-arrows`;
  const n = cellCount(def.grid);
  const centers = Array.from({ length: n }, (_, i) => cellCenter(def.grid, i));

  ensureArrowImage(map);
  map.addSource(sourceId, { type: "geojson", data: { type: "FeatureCollection", features: [] } });
  map.addLayer(
    {
      id: layerId,
      type: "symbol",
      source: sourceId,
      layout: {
        "icon-image": ARROW_IMAGE,
        "icon-rotate": ["get", "bearing"],
        "icon-rotation-alignment": "map",
        "icon-allow-overlap": true,
        "icon-ignore-placement": true,
        "icon-size": ["interpolate", ["linear"], ["get", "speed"], 0, 0.35, def.domain[1], 1.1],
      },
      paint: {
        "icon-color": rampExpression(def.ramp, ["get", "speed"]),
        "icon-halo-color": "rgba(255,255,255,0.9)",
        "icon-halo-width": 1.2,
        "icon-opacity": 0,
        "icon-opacity-transition": OPACITY_TRANSITION,
      },
    },
    beforeId,
  );

  const u = new Float32Array(n);
  const v = new Float32Array(n);
  let hasValues = false;
  let current: LayerFrame | null = null;
  let cancelTween = () => {};

  const opacity = createOpacityState((value) => map.setPaintProperty(layerId, "icon-opacity", value));

  function push(): void {
    const features: Feature<Point>[] = centers.map((center, i) => {
      const cu = u[i] ?? 0;
      const cv = v[i] ?? 0;
      return {
        type: "Feature",
        id: i,
        properties: { speed: windSpeed(cu, cv), bearing: windBearing(cu, cv) },
        geometry: { type: "Point", coordinates: [...center] },
      };
    });
    void map.getSource<GeoJSONSource>(sourceId)?.setData({ type: "FeatureCollection", features });
  }

  return {
    bottomLayerId: layerId,

    setFrame(frame) {
      if (frame === current) return;
      current = frame;
      opacity.setHasFrame(frame !== null);
      if (frame === null || frame.kind !== "vector") return;

      cancelTween();
      if (!hasValues) {
        u.set(frame.u);
        v.set(frame.v);
        push();
        hasValues = true;
        return;
      }
      const fromU = u.slice();
      const fromV = v.slice();
      cancelTween = animate(FRAME_TWEEN_MS, (p) => {
        lerpInto(u, fromU, frame.u, p);
        lerpInto(v, fromV, frame.v, p);
        push();
      });
    },

    setOpacity: opacity.setOpacity,
    setStale: opacity.setStale,

    destroy() {
      cancelTween();
      map.removeLayer(layerId);
      map.removeSource(sourceId);
    },
  };
}
