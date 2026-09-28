import type { ExpressionSpecification } from "maplibre-gl";
import type { LayerFrame } from "../../domain/layer";

/**
 * Imperative adapter between one GIS layer and MapLibre. The map controller
 * only calls these methods with values derived from the store; each renderer
 * ignores calls that don't change anything, so syncing is cheap to repeat.
 */
export interface LayerRenderer {
  /** Lowest style layer id — others are inserted beneath it to keep draw order stable. */
  readonly bottomLayerId: string;
  /** `null` = no data at the selected time; the layer fades out but keeps its last values. */
  setFrame(frame: LayerFrame | null): void;
  setOpacity(opacity: number): void;
  /** Keep showing the previous frame, dimmed, while the new one loads (or failed). */
  setStale(stale: boolean): void;
  destroy(): void;
}

export const FRAME_TWEEN_MS = 450;
export const OPACITY_TRANSITION = { duration: 300, delay: 0 } as const;
const STALE_DIM = 0.45;

/**
 * Weather cells are tens of kilometres wide; at street level they'd only wash
 * over the city, so data fades as the camera zooms in.
 */
function fadeWithZoom(opacity: number): number | ExpressionSpecification {
  if (opacity === 0) return 0;
  return ["interpolate", ["linear"], ["zoom"], 9, opacity, 13, opacity * 0.2];
}

/** Folds the three visibility inputs into one paint value, updating only on change. */
export function createOpacityState(apply: (opacity: number | ExpressionSpecification) => void) {
  let opacity = 1;
  let stale = false;
  let hasFrame = false;
  let applied = Number.NaN;

  function update(): void {
    const next = hasFrame ? opacity * (stale ? STALE_DIM : 1) : 0;
    if (next === applied) return;
    applied = next;
    apply(fadeWithZoom(next));
  }

  return {
    setOpacity(value: number) {
      opacity = value;
      update();
    },
    setStale(value: boolean) {
      stale = value;
      update();
    },
    setHasFrame(value: boolean) {
      hasFrame = value;
      update();
    },
  };
}
