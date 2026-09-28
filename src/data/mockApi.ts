import { LAYERS, type LayerId } from "../config/layers";
import { cellCenter, cellCount, type CellIndex, type GridSpec } from "../domain/grid";
import type { LayerFrame, LayerSeries, SeriesPoint, SeriesScope } from "../domain/layer";
import { windSpeed } from "../domain/layer";
import { axisTimes, type Timestamp } from "../domain/time";
import { AbortedError, type LayerDataApi } from "./api";
import { insolationAt, temperatureAt, windAt } from "./fields";

type Sampler =
  | { readonly kind: "scalar"; readonly sample: (lng: number, lat: number, t: Timestamp) => number }
  | {
      readonly kind: "vector";
      readonly sample: (lng: number, lat: number, t: Timestamp) => { u: number; v: number };
    };

/** Mock "backend" data sources — in a real app each layer's definition would carry an endpoint instead. */
const SAMPLERS: Readonly<Record<LayerId, Sampler>> = {
  temperature: { kind: "scalar", sample: temperatureAt },
  insolation: { kind: "scalar", sample: insolationAt },
  wind: { kind: "vector", sample: windAt },
};

export function buildFrame(layerId: LayerId, validTime: Timestamp): LayerFrame {
  const { grid } = LAYERS[layerId];
  const sampler = SAMPLERS[layerId];
  const n = cellCount(grid);

  if (sampler.kind === "scalar") {
    const values = new Float32Array(n);
    for (let i = 0; i < n; i += 1) {
      const [lng, lat] = cellCenter(grid, i);
      values[i] = sampler.sample(lng, lat, validTime);
    }
    return { kind: "scalar", validTime, values };
  }

  const u = new Float32Array(n);
  const v = new Float32Array(n);
  for (let i = 0; i < n; i += 1) {
    const [lng, lat] = cellCenter(grid, i);
    const wind = sampler.sample(lng, lat, validTime);
    u[i] = wind.u;
    v[i] = wind.v;
  }
  return { kind: "vector", validTime, u, v };
}

function magnitudeAt(sampler: Sampler, grid: GridSpec, cell: CellIndex, t: Timestamp): number {
  const [lng, lat] = cellCenter(grid, cell);
  if (sampler.kind === "scalar") return sampler.sample(lng, lat, t);
  const { u, v } = sampler.sample(lng, lat, t);
  return windSpeed(u, v);
}

export function buildSeries(layerId: LayerId, scope: SeriesScope): LayerSeries {
  const { grid, timeAxis } = LAYERS[layerId];
  const sampler = SAMPLERS[layerId];

  const points: SeriesPoint[] = axisTimes(timeAxis).map((t) => {
    if (scope.type === "cell") {
      const value = magnitudeAt(sampler, grid, scope.cell, t);
      return { t, value, min: value, max: value };
    }
    let min = Infinity;
    let max = -Infinity;
    let sum = 0;
    const n = cellCount(grid);
    for (let i = 0; i < n; i += 1) {
      const value = magnitudeAt(sampler, grid, i, t);
      min = Math.min(min, value);
      max = Math.max(max, value);
      sum += value;
    }
    return { t, value: sum / n, min, max };
  });

  return { scope, points };
}

export interface MockApiOptions {
  /** Wide latency spread on purpose: fast timeline scrubbing produces out-of-order responses. */
  readonly latencyMs: readonly [min: number, max: number];
  readonly failureRate: number;
  readonly random: () => number;
}

export const DEFAULT_MOCK_OPTIONS: MockApiOptions = {
  latencyMs: [250, 1200],
  failureRate: 0.06,
  random: Math.random,
};

function respond<T>(options: MockApiOptions, signal: AbortSignal, compute: () => T): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    if (signal.aborted) {
      reject(new AbortedError());
      return;
    }
    const [min, max] = options.latencyMs;
    const timer = setTimeout(() => {
      signal.removeEventListener("abort", onAbort);
      if (options.random() < options.failureRate) {
        reject(new Error("Сервер данных недоступен (503)"));
      } else {
        resolve(compute());
      }
    }, min + options.random() * (max - min));

    function onAbort() {
      clearTimeout(timer);
      reject(new AbortedError());
    }
    signal.addEventListener("abort", onAbort, { once: true });
  });
}

export function createMockApi(options: MockApiOptions = DEFAULT_MOCK_OPTIONS): LayerDataApi {
  return {
    fetchFrame: (layerId, validTime, signal) =>
      respond(options, signal, () => buildFrame(layerId, validTime)),
    fetchSeries: (layerId, scope, signal) =>
      respond(options, signal, () => buildSeries(layerId, scope)),
  };
}
