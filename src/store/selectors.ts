import { LAYER_ORDER, LAYERS, TIMELINE_AXIS, type LayerId } from "../config/layers";
import { cellAt, type CellIndex } from "../domain/grid";
import type { LayerFrame, SeriesScope } from "../domain/layer";
import { resolveValidTime, type Timestamp } from "../domain/time";
import type { AppState, FrameKey, Resource, SeriesKey } from "./state";

// Pure derivations shared by React components, the map controller and data
// sync — every consumer reads the same "selected time → layer data" chain.

export function frameKey(layerId: LayerId, validTime: Timestamp): FrameKey {
  return `${layerId}@${validTime}`;
}

export function seriesKey(layerId: LayerId, scope: SeriesScope): SeriesKey {
  return `${layerId}:${scope.type === "cell" ? scope.cell : "region"}`;
}

export function selectResolvedTime(state: AppState, layerId: LayerId): Timestamp | null {
  return resolveValidTime(LAYERS[layerId].timeAxis, state.timeline.selected);
}

/** Layers have different grids, so one probed point maps to a different cell per layer. */
export function selectProbeCell(state: AppState, layerId: LayerId): CellIndex | null {
  return state.probe ? cellAt(LAYERS[layerId].grid, state.probe.lngLat) : null;
}

export function selectSeriesScope(state: AppState, layerId: LayerId): SeriesScope {
  const cell = selectProbeCell(state, layerId);
  return cell === null ? { type: "region" } : { type: "cell", cell };
}

export function selectSeriesKey(state: AppState, layerId: LayerId): SeriesKey {
  return seriesKey(layerId, selectSeriesScope(state, layerId));
}

export function selectActiveLayerIds(state: AppState): LayerId[] {
  return LAYER_ORDER.filter((id) => state.layers[id].enabled);
}

/** `null` means the layer has no data at the selected time (outside its axis). */
export function selectLayerFrame(state: AppState, layerId: LayerId): Resource<LayerFrame> | undefined | null {
  const validTime = selectResolvedTime(state, layerId);
  return validTime === null ? null : state.frames[frameKey(layerId, validTime)];
}

export type LayerStatus = "off" | "no-data" | "loading" | "ready" | "error";

export function selectLayerStatus(state: AppState, layerId: LayerId): LayerStatus {
  if (!state.layers[layerId].enabled) return "off";
  const frame = selectLayerFrame(state, layerId);
  if (frame === null) return "no-data";
  if (frame === undefined || frame.status === "loading") return "loading";
  return frame.status === "success" ? "ready" : "error";
}

/** Playback only advances once every active layer has settled, so it never outruns the data. */
export function selectActiveFramesSettled(state: AppState): boolean {
  return selectActiveLayerIds(state).every((id) => selectLayerStatus(state, id) !== "loading");
}

export interface FrameRequest {
  readonly key: FrameKey;
  readonly layerId: LayerId;
  readonly validTime: Timestamp;
}

export interface SeriesRequest {
  readonly key: SeriesKey;
  readonly layerId: LayerId;
  readonly scope: SeriesScope;
}

/**
 * Everything the UI needs right now. Data sync diffs this against the cache
 * and in-flight requests: missing → fetch, no longer wanted → abort.
 */
export function selectWantedRequests(state: AppState): {
  frames: FrameRequest[];
  series: SeriesRequest[];
} {
  const frames: FrameRequest[] = [];
  const series: SeriesRequest[] = [];

  for (const layerId of selectActiveLayerIds(state)) {
    const { timeAxis } = LAYERS[layerId];
    const current = resolveValidTime(timeAxis, state.timeline.selected);
    if (current !== null) frames.push({ key: frameKey(layerId, current), layerId, validTime: current });

    if (state.timeline.playing) {
      // Prefetch the next step so playback animates instead of waiting.
      const next = resolveValidTime(timeAxis, state.timeline.selected + TIMELINE_AXIS.stepMs);
      if (next !== null && next !== current) frames.push({ key: frameKey(layerId, next), layerId, validTime: next });
    }

    const scope = selectSeriesScope(state, layerId);
    series.push({ key: seriesKey(layerId, scope), layerId, scope });
  }

  return { frames, series };
}
