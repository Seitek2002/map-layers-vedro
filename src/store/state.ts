import { LAYERS, TIMELINE_AXIS, type LayerId } from "../config/layers";
import type { LngLat } from "../domain/grid";
import type { LayerFrame, LayerSeries } from "../domain/layer";
import { HOUR_MS, type Timestamp } from "../domain/time";
import { mapRecord } from "../utils/record";

/** Frame cache key: one layer at one valid time. */
export type FrameKey = `${LayerId}@${number}`;
/** Series cache key: one layer for one scope (whole region or a single cell). */
export type SeriesKey = `${LayerId}:${"region" | number}`;

export type Resource<T> =
  | { readonly status: "loading" }
  | { readonly status: "success"; readonly data: T }
  | { readonly status: "error"; readonly message: string };

export interface LayerSettings {
  readonly enabled: boolean;
  readonly opacity: number;
}

export interface TimelineState {
  /** The single "selected time" every consumer derives from. Always a timeline step. */
  readonly selected: Timestamp;
  readonly playing: boolean;
}

export interface Probe {
  readonly lngLat: LngLat;
}

export interface NetworkStats {
  readonly inFlight: number;
  readonly completed: number;
  readonly aborted: number;
  readonly failed: number;
}

/**
 * What the user chose (layers, timeline, probe) plus what has been loaded
 * (frames, series) — normalized, keyed caches rather than per-layer "current
 * data" slots. A response can only ever write its own key, so an out-of-order
 * response cannot overwrite what the UI currently shows.
 */
export interface AppState {
  readonly layers: Readonly<Record<LayerId, LayerSettings>>;
  readonly timeline: TimelineState;
  readonly probe: Probe | null;
  readonly frames: Readonly<Partial<Record<FrameKey, Resource<LayerFrame>>>>;
  readonly series: Readonly<Partial<Record<SeriesKey, Resource<LayerSeries>>>>;
  readonly network: NetworkStats;
}

const INITIALLY_ENABLED: ReadonlySet<LayerId> = new Set(["temperature", "wind"]);

export function createInitialState(): AppState {
  return {
    layers: mapRecord(LAYERS, (_, id) => ({ enabled: INITIALLY_ENABLED.has(id), opacity: 0.75 })),
    timeline: { selected: TIMELINE_AXIS.start + 12 * HOUR_MS, playing: false },
    probe: null,
    frames: {},
    series: {},
    network: { inFlight: 0, completed: 0, aborted: 0, failed: 0 },
  };
}
