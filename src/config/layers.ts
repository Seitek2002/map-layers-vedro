import type { ColorRamp } from "../domain/colorRamp";
import type { BBox, LngLat } from "../domain/grid";
import type { LayerDefinition } from "../domain/layer";
import { HOUR_MS, type TimeAxis } from "../domain/time";

/** Kyrgyzstan — the data region all mock layers cover. */
export const REGION: BBox = { west: 69.2, south: 39.2, east: 80.3, north: 43.3 };

export const BISHKEK: LngLat = [74.59, 42.87];

/** 2026-06-21 00:00 in Asia/Bishkek (UTC+6) — summer solstice, so insolation has a full day to show. */
export const DAY_START = Date.UTC(2026, 5, 20, 18);

/** The global timeline: the finest cadence any layer publishes at. */
export const TIMELINE_AXIS: TimeAxis = { start: DAY_START, stepMs: HOUR_MS, count: 24 };

const TEMPERATURE_RAMP: ColorRamp = [
  [-5, "#3b4cc0"],
  [5, "#6f92f3"],
  [15, "#dddddd"],
  [25, "#f49a7b"],
  [35, "#b40426"],
];

const INSOLATION_RAMP: ColorRamp = [
  [0, "#4b3f72"],
  [250, "#c2549d"],
  [550, "#f28f3b"],
  [800, "#ffd23f"],
  [1000, "#fff3b0"],
];

const WIND_RAMP: ColorRamp = [
  [0, "#1b9e77"],
  [5, "#2c7fb8"],
  [10, "#7b3294"],
  [16, "#d7191c"],
];

export type LayerId = "temperature" | "insolation" | "wind";

/**
 * The only place a layer is described. Adding the 4th (or the 100th) layer of
 * an existing kind is one entry here plus a data source — no store, map or UI
 * changes; `Record<LayerId, …>` makes the compiler point at anything missing.
 */
export const LAYERS: Readonly<Record<LayerId, LayerDefinition<LayerId>>> = {
  temperature: {
    id: "temperature",
    title: "Температура",
    unit: "°C",
    kind: "grid",
    grid: { bbox: REGION, cols: 30, rows: 12 },
    timeAxis: { start: DAY_START, stepMs: HOUR_MS, count: 24 },
    domain: [-5, 35],
    ramp: TEMPERATURE_RAMP,
    accent: "#e4572e",
  },
  insolation: {
    id: "insolation",
    title: "Инсоляция",
    unit: "Вт/м²",
    kind: "points",
    grid: { bbox: REGION, cols: 18, rows: 7 },
    // Daylight-only product: no data before 05:00 or after 20:00.
    timeAxis: { start: DAY_START + 5 * HOUR_MS, stepMs: HOUR_MS, count: 16 },
    domain: [0, 1000],
    ramp: INSOLATION_RAMP,
    accent: "#f0a202",
    radiusPx: [2, 11],
  },
  wind: {
    id: "wind",
    title: "Ветер",
    unit: "м/с",
    kind: "vectors",
    grid: { bbox: REGION, cols: 12, rows: 5 },
    // Coarser 3-hourly cadence: 04:00 shows the 03:00 frame.
    timeAxis: { start: DAY_START, stepMs: 3 * HOUR_MS, count: 8 },
    domain: [0, 16],
    ramp: WIND_RAMP,
    accent: "#2e86de",
  },
};

/** Draw order on the map (bottom → top) and display order in the UI. */
export const LAYER_ORDER: readonly LayerId[] = ["temperature", "insolation", "wind"];
