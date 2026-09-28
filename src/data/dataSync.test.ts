import Vedro from "vedro";
import { afterEach, describe, expect, it } from "vitest";
import { BISHKEK, TIMELINE_AXIS, type LayerId } from "../config/layers";
import type { SeriesScope } from "../domain/layer";
import { HOUR_MS, type Timestamp } from "../domain/time";
import { createActions } from "../store/actions";
import { frameKey, selectLayerStatus } from "../store/selectors";
import { createInitialState, type AppState } from "../store/state";
import type { LayerDataApi } from "./api";
import { startDataSync } from "./dataSync";
import { buildFrame, buildSeries } from "./mockApi";

interface Call {
  readonly kind: "frame" | "series";
  readonly layerId: LayerId;
  readonly validTime: Timestamp | null;
  readonly scope: SeriesScope | null;
  readonly signal: AbortSignal;
  resolve(): void;
  reject(error: Error): void;
}

/**
 * Transport that settles only when the test says so and deliberately ignores
 * AbortSignal — proving that correctness doesn't depend on the transport
 * honouring cancellation.
 */
function createControlledApi() {
  const calls: Call[] = [];
  const api: LayerDataApi = {
    fetchFrame: (layerId, validTime, signal) =>
      new Promise((resolve, reject) => {
        calls.push({
          kind: "frame", layerId, validTime, scope: null, signal,
          resolve: () => resolve(buildFrame(layerId, validTime)),
          reject,
        });
      }),
    fetchSeries: (layerId, scope, signal) =>
      new Promise((resolve, reject) => {
        calls.push({
          kind: "series", layerId, validTime: null, scope, signal,
          resolve: () => resolve(buildSeries(layerId, scope)),
          reject,
        });
      }),
  };
  const frameCalls = (layerId: LayerId) => calls.filter((c) => c.kind === "frame" && c.layerId === layerId);
  return { api, calls, frameCalls };
}

const at = (hour: number): Timestamp => TIMELINE_AXIS.start + hour * HOUR_MS;
const flush = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

let stop: (() => void) | null = null;

function setup(initial: Partial<AppState> = {}) {
  const store = new Vedro<AppState>({ ...createInitialState(), ...initial });
  const actions = createActions(store);
  const transport = createControlledApi();
  stop = startDataSync(store, transport.api);
  return { store, actions, ...transport };
}

afterEach(() => {
  stop?.();
  stop = null;
});

describe("DataSync", () => {
  it("loads the selected frame and the chart series for every active layer", async () => {
    const { store, calls } = setup();
    await flush();

    const requested = calls.map((c) => `${c.kind}:${c.layerId}`).sort();
    expect(requested).toEqual(["frame:temperature", "frame:wind", "series:temperature", "series:wind"]);

    calls.forEach((c) => c.resolve());
    await flush();

    const state = store.get();
    expect(selectLayerStatus(state, "temperature")).toBe("ready");
    expect(selectLayerStatus(state, "wind")).toBe("ready");
    expect(state.network).toMatchObject({ inFlight: 0, completed: 4, aborted: 0 });
  });

  it("fast scrubbing: aborts superseded requests and ignores their late responses", async () => {
    const { store, actions, frameCalls } = setup();
    await flush();
    actions.selectTime(at(13));
    await flush();
    actions.selectTime(at(14));
    await flush();

    const [t12, t13, t14] = frameCalls("temperature");
    expect([t12?.validTime, t13?.validTime, t14?.validTime]).toEqual([at(12), at(13), at(14)]);
    expect(t12?.signal.aborted).toBe(true);
    expect(t13?.signal.aborted).toBe(true);
    expect(t14?.signal.aborted).toBe(false);

    // Newest first, then the stale ones arrive out of order.
    t14?.resolve();
    await flush();
    t12?.resolve();
    t13?.resolve();
    await flush();

    const state = store.get();
    expect(state.frames[frameKey("temperature", at(14))]?.status).toBe("success");
    expect(state.frames[frameKey("temperature", at(12))]).toBeUndefined();
    expect(state.frames[frameKey("temperature", at(13))]).toBeUndefined();
    expect(state.network.aborted).toBeGreaterThanOrEqual(2);
  });

  it("does not refetch while the selected time stays within a coarser layer's step", async () => {
    const { actions, frameCalls } = setup();
    await flush();
    actions.selectTime(at(13));
    await flush();
    actions.selectTime(at(14));
    await flush();

    // Wind is 3-hourly: 12:00, 13:00 and 14:00 all resolve to the 12:00 frame.
    const wind = frameCalls("wind");
    expect(wind).toHaveLength(1);
    expect(wind[0]?.signal.aborted).toBe(false);
  });

  it("switching a layer off aborts its request; a loaded frame is reused on re-enable", async () => {
    const { actions, frameCalls } = setup();
    actions.setLayerEnabled("insolation", true);
    await flush();
    actions.setLayerEnabled("insolation", false);
    await flush();
    expect(frameCalls("insolation")[0]?.signal.aborted).toBe(true);

    actions.setLayerEnabled("insolation", true);
    await flush();
    const retried = frameCalls("insolation");
    expect(retried).toHaveLength(2);
    retried[1]?.resolve();
    await flush();

    actions.setLayerEnabled("insolation", false);
    await flush();
    actions.setLayerEnabled("insolation", true);
    await flush();
    expect(frameCalls("insolation")).toHaveLength(2);
  });

  it("keeps an error until retry, then refetches", async () => {
    const { store, actions, frameCalls } = setup();
    await flush();
    frameCalls("temperature")[0]?.reject(new Error("503"));
    await flush();
    expect(selectLayerStatus(store.get(), "temperature")).toBe("error");

    actions.retryLayer("temperature");
    await flush();
    const retry = frameCalls("temperature")[1];
    expect(retry).toBeDefined();
    retry?.resolve();
    await flush();
    expect(selectLayerStatus(store.get(), "temperature")).toBe("ready");
  });

  it("moving the map probe aborts the previous point series", async () => {
    const { actions, calls } = setup();
    await flush();
    actions.setProbe([72.0, 40.8]);
    await flush();
    actions.setProbe(BISHKEK);
    await flush();

    const pointSeries = calls.filter((c) => c.kind === "series" && c.layerId === "temperature" && c.scope?.type === "cell");
    expect(pointSeries).toHaveLength(2);
    expect(pointSeries[0]?.signal.aborted).toBe(true);
    expect(pointSeries[1]?.signal.aborted).toBe(false);
  });
});
