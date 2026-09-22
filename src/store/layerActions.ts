import type Vedro from "vedro";
import { fetchLayerData } from "../api/mockLayerApi";
import type { LayerId, LayerState, LayersState } from "../types/layer";
import { buildLayersState, createLayerState } from "./buildLayersState";
import { INITIAL_LAYER_DEFINITIONS } from "./layerDefinitions";

export interface LayerActions {
  setEnabled(id: LayerId, enabled: boolean): void;
  setOpacity(id: LayerId, opacity: number): void;
  retry(id: LayerId): void;
  addLayers(count: number): void;
  reset(): void;
}

type LayerPatch = Partial<Omit<LayerState, "id" | "label">>;

function patchLayer(store: Vedro<LayersState>, id: LayerId, patch: LayerPatch): void {
  store.dispatch((state) => {
    const current = state.layers[id];
    if (!current) return {};
    return {
      layers: {
        ...state.layers,
        [id]: { ...current, ...patch },
      },
    };
  });
}

/**
 * Pure factory so the race-condition logic can be unit-tested against a bare
 * Vedro store, without mounting React.
 */
export function createLayerActions(
  store: Vedro<LayersState>,
  controllers: Map<LayerId, AbortController>,
): LayerActions {
  function load(id: LayerId): void {
    // Superseding a still-in-flight request is the whole race-condition fix:
    // only the controller created by the *latest* call ever gets to write state.
    controllers.get(id)?.abort();
    const controller = new AbortController();
    controllers.set(id, controller);

    const current = store.get("layers")[id];
    const nextVersion = (current?.requestVersion ?? 0) + 1;

    patchLayer(store, id, {
      enabled: true,
      status: "loading",
      error: null,
      requestVersion: nextVersion,
    });

    fetchLayerData(id, controller.signal).then(
      () => {
        if (controller.signal.aborted) return;
        patchLayer(store, id, { status: "success", error: null });
      },
      (error: unknown) => {
        if (controller.signal.aborted) return;
        const message = error instanceof Error ? error.message : "Неизвестная ошибка";
        patchLayer(store, id, { status: "error", error: message });
      },
    );
  }

  function unload(id: LayerId): void {
    controllers.get(id)?.abort();
    controllers.delete(id);
    patchLayer(store, id, { enabled: false, status: "idle", error: null });
  }

  return {
    setEnabled(id, enabled) {
      if (enabled) {
        load(id);
      } else {
        unload(id);
      }
    },
    setOpacity(id, opacity) {
      patchLayer(store, id, { opacity });
    },
    retry(id) {
      load(id);
    },
    addLayers(count) {
      store.dispatch((state) => {
        const layerIds = [...state.layerIds];
        const layers = { ...state.layers };
        const startIndex = layerIds.length + 1;
        for (let i = 0; i < count; i += 1) {
          const id = `layer-${startIndex + i}`;
          layerIds.push(id);
          layers[id] = createLayerState({ id, label: `Слой ${startIndex + i}` });
        }
        return { layerIds, layers };
      });
    },
    reset() {
      controllers.forEach((controller) => controller.abort());
      controllers.clear();
      store.dispatch(() => buildLayersState(INITIAL_LAYER_DEFINITIONS));
    },
  };
}
