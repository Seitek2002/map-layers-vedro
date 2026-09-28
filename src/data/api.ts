import type { LayerId } from "../config/layers";
import type { LayerFrame, LayerSeries, SeriesScope } from "../domain/layer";
import type { Timestamp } from "../domain/time";

/**
 * The data boundary. The app only knows this interface; swapping the mock for
 * an HTTP/tiles implementation doesn't touch the store, map or UI.
 *
 * Two endpoints on purpose — as in real weather APIs: frames are heavy and
 * per-time (loaded on demand as the timeline moves), series are light
 * aggregates for charts (loaded once per layer + scope).
 */
export interface LayerDataApi {
  fetchFrame(layerId: LayerId, validTime: Timestamp, signal: AbortSignal): Promise<LayerFrame>;
  fetchSeries(layerId: LayerId, scope: SeriesScope, signal: AbortSignal): Promise<LayerSeries>;
}

export class AbortedError extends Error {
  constructor() {
    super("Request aborted");
    this.name = "AbortedError";
  }
}
