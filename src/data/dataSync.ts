import type { LayerFrame, LayerSeries } from "../domain/layer";
import { selectWantedRequests, type FrameRequest, type SeriesRequest } from "../store/selectors";
import type { AppState, FrameKey, Resource, SeriesKey } from "../store/state";
import { subscribe, type AppStore } from "../store/store";
import { typedKeys } from "../utils/record";
import type { LayerDataApi } from "./api";

type Cache<K extends string, T> = Readonly<Partial<Record<K, Resource<T>>>>;

/** One keyed cache in the state (frames or series) plus its in-flight requests. */
interface Channel<K extends string, R extends { readonly key: K }, T> {
  readonly inflight: Map<K, AbortController>;
  read(state: AppState): Cache<K, T>;
  write(cache: Cache<K, T>): Partial<AppState>;
  fetch(request: R, signal: AbortSignal): Promise<T>;
}

interface Plan<K extends string, R> {
  readonly abort: K[];
  readonly drop: K[];
  readonly start: R[];
}

function plan<K extends string, R extends { readonly key: K }, T>(
  channel: Channel<K, R, T>,
  state: AppState,
  wanted: readonly R[],
): Plan<K, R> {
  const cache = channel.read(state);
  const wantedKeys = new Set<K>(wanted.map((r) => r.key));

  const abort = [...channel.inflight.keys()].filter((key) => !wantedKeys.has(key));
  const aborting = new Set(abort);

  // A "loading" entry nobody is fetching (aborted just now, or left over from
  // a previous DataSync instance) must not linger, or it would block a refetch.
  const drop = typedKeys(cache).filter(
    (key) =>
      cache[key]?.status === "loading" &&
      !wantedKeys.has(key) &&
      (aborting.has(key) || !channel.inflight.has(key)),
  );

  const start = wanted.filter((r) => {
    const entry = cache[r.key];
    return entry === undefined || (entry.status === "loading" && !channel.inflight.has(r.key));
  });

  return { abort, drop, start };
}

function applyPlan<K extends string, R extends { readonly key: K }, T>(
  cache: Cache<K, T>,
  { drop, start }: Plan<K, R>,
): Cache<K, T> {
  if (drop.length === 0 && start.length === 0) return cache;
  const next: Partial<Record<K, Resource<T>>> = { ...cache };
  for (const key of drop) delete next[key];
  for (const request of start) next[request.key] = { status: "loading" };
  return next;
}

/**
 * Keeps the frame/series caches in step with what the UI currently needs.
 *
 * Race conditions are handled at two levels:
 * 1. Correctness — results are cached by key (`layer@validTime`,
 *    `layer:scope`), never written into a "current data" slot. A late response
 *    for 11:00 can only fill the 11:00 entry; it cannot replace what is shown
 *    for 12:00. No request ordering is assumed.
 * 2. Efficiency — requests the UI no longer wants (the user scrubbed past, the
 *    layer was switched off, the probe moved) are aborted, and their result is
 *    ignored even if the transport resolves anyway.
 *
 * Reconciliation is scheduled once per microtask, so a burst of dispatches
 * (e.g. dragging the timeline) collapses into a single pass and one dispatch.
 */
export function startDataSync(store: AppStore, api: LayerDataApi): () => void {
  const frames: Channel<FrameKey, FrameRequest, LayerFrame> = {
    inflight: new Map(),
    read: (s) => s.frames,
    write: (cache) => ({ frames: cache }),
    fetch: (r, signal) => api.fetchFrame(r.layerId, r.validTime, signal),
  };
  const series: Channel<SeriesKey, SeriesRequest, LayerSeries> = {
    inflight: new Map(),
    read: (s) => s.series,
    write: (cache) => ({ series: cache }),
    fetch: (r, signal) => api.fetchSeries(r.layerId, r.scope, signal),
  };

  let scheduled = false;
  let stopped = false;

  const inFlightCount = () => frames.inflight.size + series.inflight.size;

  function schedule(): void {
    if (scheduled || stopped) return;
    scheduled = true;
    queueMicrotask(reconcile);
  }

  function reconcile(): void {
    scheduled = false;
    if (stopped) return;

    const state = store.get();
    const wanted = selectWantedRequests(state);
    const framePlan = plan(frames, state, wanted.frames);
    const seriesPlan = plan(series, state, wanted.series);

    const aborted = abortAll(frames, framePlan.abort) + abortAll(series, seriesPlan.abort);
    const nothingChanged =
      aborted === 0 &&
      framePlan.drop.length + framePlan.start.length + seriesPlan.drop.length + seriesPlan.start.length === 0;
    if (nothingChanged) return;

    const frameControllers = framePlan.start.map((r) => register(frames, r.key));
    const seriesControllers = seriesPlan.start.map((r) => register(series, r.key));

    store.dispatch((s) => ({
      ...frames.write(applyPlan(s.frames, framePlan)),
      ...series.write(applyPlan(s.series, seriesPlan)),
      network: { ...s.network, aborted: s.network.aborted + aborted, inFlight: inFlightCount() },
    }));

    framePlan.start.forEach((r, i) => launch(frames, r, frameControllers[i]));
    seriesPlan.start.forEach((r, i) => launch(series, r, seriesControllers[i]));
  }

  function abortAll<K extends string, R extends { readonly key: K }, T>(
    channel: Channel<K, R, T>,
    keys: readonly K[],
  ): number {
    for (const key of keys) {
      channel.inflight.get(key)?.abort();
      channel.inflight.delete(key);
    }
    return keys.length;
  }

  function register<K extends string, R extends { readonly key: K }, T>(
    channel: Channel<K, R, T>,
    key: K,
  ): AbortController {
    const controller = new AbortController();
    channel.inflight.set(key, controller);
    return controller;
  }

  function launch<K extends string, R extends { readonly key: K }, T>(
    channel: Channel<K, R, T>,
    request: R,
    controller: AbortController | undefined,
  ): void {
    if (!controller) return;
    channel.fetch(request, controller.signal).then(
      (data) => settle(channel, request.key, controller, { status: "success", data }),
      (error: unknown) =>
        settle(channel, request.key, controller, {
          status: "error",
          message: error instanceof Error ? error.message : "Неизвестная ошибка",
        }),
    );
  }

  function settle<K extends string, R extends { readonly key: K }, T>(
    channel: Channel<K, R, T>,
    key: K,
    controller: AbortController,
    resource: Resource<T>,
  ): void {
    // Aborted, or superseded by a newer request for the same key: drop it.
    if (stopped || controller.signal.aborted || channel.inflight.get(key) !== controller) return;
    channel.inflight.delete(key);
    const failed = resource.status === "error";
    store.dispatch((s) => ({
      ...channel.write({ ...channel.read(s), [key]: resource }),
      network: {
        ...s.network,
        inFlight: inFlightCount(),
        completed: s.network.completed + (failed ? 0 : 1),
        failed: s.network.failed + (failed ? 1 : 0),
      },
    }));
  }

  const unsubscribe = subscribe(store, schedule);

  return () => {
    stopped = true;
    unsubscribe();
    abortAll(frames, [...frames.inflight.keys()]);
    abortAll(series, [...series.inflight.keys()]);
  };
}
