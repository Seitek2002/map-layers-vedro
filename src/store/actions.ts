import { REGION, TIMELINE_AXIS, type LayerId } from "../config/layers";
import { containsPoint, type LngLat } from "../domain/grid";
import { indexOnAxis, snapToAxis, type Timestamp } from "../domain/time";
import { omitKeys, typedKeys } from "../utils/record";
import type { AppStore } from "./store";

/**
 * The only way UI and map change state. Each action is a synchronous
 * `dispatch`; no-op changes are skipped because every dispatch notifies every
 * subscriber.
 */
export interface AppActions {
  setLayerEnabled(id: LayerId, enabled: boolean): void;
  setLayerOpacity(id: LayerId, opacity: number): void;
  selectTime(t: Timestamp): void;
  stepTime(delta: 1 | -1): void;
  setPlaying(playing: boolean): void;
  setProbe(lngLat: LngLat): void;
  clearProbe(): void;
  retryLayer(id: LayerId): void;
}

export function createActions(store: AppStore): AppActions {
  function selectTime(t: Timestamp): void {
    const selected = snapToAxis(TIMELINE_AXIS, t);
    if (selected === store.get("timeline").selected) return;
    store.dispatch((s) => ({ timeline: { ...s.timeline, selected } }));
  }

  return {
    setLayerEnabled(id, enabled) {
      if (store.get("layers")[id].enabled === enabled) return;
      store.dispatch((s) => ({ layers: { ...s.layers, [id]: { ...s.layers[id], enabled } } }));
    },

    setLayerOpacity(id, opacity) {
      if (store.get("layers")[id].opacity === opacity) return;
      store.dispatch((s) => ({ layers: { ...s.layers, [id]: { ...s.layers[id], opacity } } }));
    },

    selectTime,

    stepTime(delta) {
      const index = indexOnAxis(TIMELINE_AXIS, store.get("timeline").selected);
      const next = (index + delta + TIMELINE_AXIS.count) % TIMELINE_AXIS.count;
      selectTime(TIMELINE_AXIS.start + next * TIMELINE_AXIS.stepMs);
    },

    setPlaying(playing) {
      if (store.get("timeline").playing === playing) return;
      store.dispatch((s) => ({ timeline: { ...s.timeline, playing } }));
    },

    setProbe(lngLat) {
      if (!containsPoint(REGION, lngLat)) return;
      store.dispatch({ probe: { lngLat } });
    },

    clearProbe() {
      if (store.get("probe") === null) return;
      store.dispatch({ probe: null });
    },

    retryLayer(id) {
      // Dropping the error entries is enough: data sync sees them missing and refetches.
      store.dispatch((s) => {
        const failedFrames = typedKeys(s.frames).filter(
          (key) => key.startsWith(`${id}@`) && s.frames[key]?.status === "error",
        );
        const failedSeries = typedKeys(s.series).filter(
          (key) => key.startsWith(`${id}:`) && s.series[key]?.status === "error",
        );
        return { frames: omitKeys(s.frames, failedFrames), series: omitKeys(s.series, failedSeries) };
      });
    },
  };
}
