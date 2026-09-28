import type { ColorRamp } from "./colorRamp";
import type { CellIndex, GridSpec } from "./grid";
import type { TimeAxis, Timestamp } from "./time";

/**
 * How a layer is drawn on the map. Adding a layer of an existing kind is pure
 * config; only a genuinely new visual type needs a new renderer.
 */
export type LayerKind = "grid" | "points" | "vectors";

interface LayerDefinitionBase<Id extends string> {
  readonly id: Id;
  readonly title: string;
  readonly unit: string;
  /** Spatial resolution — each layer may have its own grid. */
  readonly grid: GridSpec;
  /** Temporal coverage and cadence — each layer may have its own axis. */
  readonly timeAxis: TimeAxis;
  readonly domain: readonly [min: number, max: number];
  readonly ramp: ColorRamp;
  readonly accent: string;
}

export type LayerDefinition<Id extends string = string> =
  | (LayerDefinitionBase<Id> & { readonly kind: "grid" })
  | (LayerDefinitionBase<Id> & {
      readonly kind: "points";
      readonly radiusPx: readonly [min: number, max: number];
    })
  | (LayerDefinitionBase<Id> & { readonly kind: "vectors" });

/**
 * Values of every grid cell at one valid time. Geometry is static (derived
 * from the grid), so a time switch only ever moves numbers, never shapes.
 */
export type LayerFrame =
  | { readonly kind: "scalar"; readonly validTime: Timestamp; readonly values: Float32Array }
  | {
      readonly kind: "vector";
      readonly validTime: Timestamp;
      readonly u: Float32Array;
      readonly v: Float32Array;
    };

export type SeriesScope = { readonly type: "region" } | { readonly type: "cell"; readonly cell: CellIndex };

export interface SeriesPoint {
  readonly t: Timestamp;
  readonly value: number;
  readonly min: number;
  readonly max: number;
}

/** Time series for charts: region mean with a min–max band, or a single cell. */
export interface LayerSeries {
  readonly scope: SeriesScope;
  readonly points: readonly SeriesPoint[];
}

export function frameKindOf(kind: LayerKind): LayerFrame["kind"] {
  return kind === "vectors" ? "vector" : "scalar";
}

export function windSpeed(u: number, v: number): number {
  return Math.hypot(u, v);
}

/** Direction the wind blows *towards*, clockwise from north — what an arrow on the map shows. */
export function windBearing(u: number, v: number): number {
  return ((Math.atan2(u, v) * 180) / Math.PI + 360) % 360;
}
