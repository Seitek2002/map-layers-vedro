import Vedro from "vedro";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as mockApi from "../api/mockLayerApi";
import type { LayerId, LayersState } from "../types/layer";
import { buildLayersState } from "./buildLayersState";
import { createLayerActions, type LayerActions } from "./layerActions";
import { INITIAL_LAYER_DEFINITIONS } from "./layerDefinitions";

function setupStore() {
  const store = new Vedro<LayersState>(buildLayersState(INITIAL_LAYER_DEFINITIONS));
  const controllers = new Map<LayerId, AbortController>();
  const actions: LayerActions = createLayerActions(store, controllers);
  return { store, actions };
}

describe("layer actions race conditions", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("resolves to success once the mock request settles", async () => {
    vi.spyOn(mockApi, "fetchLayerData").mockResolvedValue({
      layerId: "temperature",
      fetchedAt: Date.now(),
    });

    const { store, actions } = setupStore();
    actions.setEnabled("temperature", true);

    expect(store.get("layers").temperature?.status).toBe("loading");
    await vi.waitFor(() => {
      expect(store.get("layers").temperature?.status).toBe("success");
    });
  });

  it("only applies the outcome of the latest request when toggled rapidly", async () => {
    // Three overlapping requests, resolving out of order: the 2nd (slowest)
    // settles last but must be ignored because a 3rd request superseded it.
    let call = 0;
    vi.spyOn(mockApi, "fetchLayerData").mockImplementation((layerId, signal) => {
      call += 1;
      const attempt = call;
      const delay = attempt === 2 ? 30 : 5;
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          resolve({ layerId, fetchedAt: attempt });
        }, delay);
        signal.addEventListener("abort", () => {
          clearTimeout(timer);
          reject(new mockApi.AbortedRequestError(layerId));
        });
      });
    });

    const { store, actions } = setupStore();

    actions.setEnabled("wind", true); // attempt 1, superseded
    actions.setEnabled("wind", false); // aborts attempt 1
    actions.setEnabled("wind", true); // attempt 2, superseded (slow)
    actions.setEnabled("wind", false); // aborts attempt 2
    actions.setEnabled("wind", true); // attempt 3, wins

    await vi.waitFor(() => {
      const layer = store.get("layers").wind;
      expect(layer?.status).toBe("success");
    });

    const layer = store.get("layers").wind;
    expect(layer?.requestVersion).toBe(3);
  });

  it("recovers via retry after an error", async () => {
    vi.spyOn(mockApi, "fetchLayerData")
      .mockRejectedValueOnce(new mockApi.LayerRequestError("insolation"))
      .mockResolvedValueOnce({ layerId: "insolation", fetchedAt: Date.now() });

    const { store, actions } = setupStore();
    actions.setEnabled("insolation", true);

    await vi.waitFor(() => {
      expect(store.get("layers").insolation?.status).toBe("error");
    });
    expect(store.get("layers").insolation?.error).toBeTruthy();

    actions.retry("insolation");

    await vi.waitFor(() => {
      expect(store.get("layers").insolation?.status).toBe("success");
    });
    expect(store.get("layers").insolation?.error).toBeNull();
  });

  it("scales layerIds/layers when bulk-adding layers", () => {
    const { store, actions } = setupStore();
    const before = store.get("layerIds").length;

    actions.addLayers(100);

    const state = store.get("layerIds");
    expect(state.length).toBe(before + 100);
    expect(Object.keys(store.get("layers")).length).toBe(before + 100);
  });
});
