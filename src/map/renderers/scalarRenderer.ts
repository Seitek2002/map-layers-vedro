import type { Feature, FeatureCollection } from "geojson";
import type { ExpressionSpecification, LayerSpecification, Map as MapLibreMap } from "maplibre-gl";
import type { LayerId } from "../../config/layers";
import type { ColorRamp } from "../../domain/colorRamp";
import { cellBounds, cellCenter, cellCount } from "../../domain/grid";
import type { LayerDefinition, LayerFrame } from "../../domain/layer";
import { animate, lerpInto } from "../tween";
import { createOpacityState, FRAME_TWEEN_MS, OPACITY_TRANSITION, type LayerRenderer } from "./types";

type ScalarLayerDefinition = Extract<LayerDefinition<LayerId>, { kind: "grid" | "points" }>;

const VALUE: ExpressionSpecification = ["feature-state", "v"];

export function rampExpression(ramp: ColorRamp, input: ExpressionSpecification): ExpressionSpecification {
  return ["interpolate", ["linear"], input, ...ramp.flatMap(([value, color]) => [value, color])];
}

function geometry(def: ScalarLayerDefinition): FeatureCollection {
  const features: Feature[] = [];
  for (let id = 0; id < cellCount(def.grid); id += 1) {
    if (def.kind === "points") {
      features.push({ type: "Feature", id, properties: {}, geometry: { type: "Point", coordinates: [...cellCenter(def.grid, id)] } });
    } else {
      const b = cellBounds(def.grid, id);
      const ring = [[b.west, b.south], [b.east, b.south], [b.east, b.north], [b.west, b.north], [b.west, b.south]];
      features.push({ type: "Feature", id, properties: {}, geometry: { type: "Polygon", coordinates: [ring] } });
    }
  }
  return { type: "FeatureCollection", features };
}

function styleLayer(def: ScalarLayerDefinition, id: string, source: string): LayerSpecification {
  const value: ExpressionSpecification = ["coalesce", VALUE, def.domain[0]];
  if (def.kind === "grid") {
    return {
      id,
      type: "fill",
      source,
      paint: {
        "fill-color": rampExpression(def.ramp, value),
        "fill-opacity": 0,
        "fill-opacity-transition": OPACITY_TRANSITION,
        "fill-antialias": false,
      },
    };
  }
  const [minRadius, maxRadius] = def.radiusPx;
  const radius = (scale: number): ExpressionSpecification => [
    "interpolate", ["linear"], value,
    def.domain[0], minRadius * scale,
    def.domain[1], maxRadius * scale,
  ];
  return {
    id,
    type: "circle",
    source,
    paint: {
      "circle-color": rampExpression(def.ramp, value),
      "circle-radius": ["interpolate", ["linear"], ["zoom"], 5, radius(0.8), 9, radius(2.2)],
      "circle-opacity": 0,
      "circle-opacity-transition": OPACITY_TRANSITION,
      "circle-stroke-width": 0.6,
      "circle-stroke-color": "#ffffff",
      "circle-stroke-opacity": 0,
      "circle-stroke-opacity-transition": OPACITY_TRANSITION,
    },
  };
}

/**
 * Grid cells (fill) or points (circle) with values in feature-state. Geometry
 * is uploaded once; switching time only updates per-feature state, which
 * MapLibre applies without re-tiling the source — the cheapest way to animate
 * values over static geometry.
 */
export function createScalarRenderer(
  map: MapLibreMap,
  def: ScalarLayerDefinition,
  beforeId: string | undefined,
): LayerRenderer {
  const sourceId = `data-${def.id}`;
  const layerId = `data-${def.id}-${def.kind}`;
  const opacityProps =
    def.kind === "grid" ? (["fill-opacity"] as const) : (["circle-opacity", "circle-stroke-opacity"] as const);

  map.addSource(sourceId, { type: "geojson", data: geometry(def) });
  map.addLayer(styleLayer(def, layerId, sourceId), beforeId);

  const displayed = new Float32Array(cellCount(def.grid));
  let hasValues = false;
  let current: LayerFrame | null = null;
  let cancelTween = () => {};

  const opacity = createOpacityState((value) => {
    for (const prop of opacityProps) map.setPaintProperty(layerId, prop, value);
  });

  function applyValues(): void {
    for (let id = 0; id < displayed.length; id += 1) {
      map.setFeatureState({ source: sourceId, id }, { v: displayed[id] });
    }
  }

  return {
    bottomLayerId: layerId,

    setFrame(frame) {
      if (frame === current) return;
      current = frame;
      opacity.setHasFrame(frame !== null);
      if (frame === null || frame.kind !== "scalar") return;

      cancelTween();
      const target = frame.values;
      if (!hasValues) {
        displayed.set(target);
        applyValues();
        hasValues = true;
        return;
      }
      const from = displayed.slice();
      cancelTween = animate(FRAME_TWEEN_MS, (p) => {
        lerpInto(displayed, from, target, p);
        applyValues();
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
