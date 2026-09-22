import type { LayerId } from "../types/layer";

export interface LayerFetchResult {
  readonly layerId: LayerId;
  readonly fetchedAt: number;
}

export class LayerRequestError extends Error {
  constructor(layerId: LayerId) {
    super(`Не удалось загрузить данные слоя "${layerId}"`);
    this.name = "LayerRequestError";
  }
}

export class AbortedRequestError extends Error {
  constructor(layerId: LayerId) {
    super(`Запрос данных слоя "${layerId}" отменён`);
    this.name = "AbortedRequestError";
  }
}

const MIN_DELAY_MS = 500;
const MAX_DELAY_MS = 1600;
const FAILURE_RATE = 0.3;

function randomDelay(): number {
  return MIN_DELAY_MS + Math.random() * (MAX_DELAY_MS - MIN_DELAY_MS);
}

/**
 * Simulates a network request for a single layer's data.
 * Honors `signal`: aborting clears the pending timer instead of letting it fire uselessly.
 */
export function fetchLayerData(
  layerId: LayerId,
  signal: AbortSignal,
): Promise<LayerFetchResult> {
  return new Promise<LayerFetchResult>((resolve, reject) => {
    if (signal.aborted) {
      reject(new AbortedRequestError(layerId));
      return;
    }

    const timer = window.setTimeout(() => {
      if (Math.random() < FAILURE_RATE) {
        reject(new LayerRequestError(layerId));
      } else {
        resolve({ layerId, fetchedAt: Date.now() });
      }
    }, randomDelay());

    signal.addEventListener(
      "abort",
      () => {
        window.clearTimeout(timer);
        reject(new AbortedRequestError(layerId));
      },
      { once: true },
    );
  });
}
