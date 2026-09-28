import { DAY_START } from "../config/layers";
import { HOUR_MS, type Timestamp } from "../domain/time";

// Deterministic synthetic weather over Kyrgyzstan. Pure functions of
// (lng, lat, time) so the same request always yields the same frame — tests
// and the chart/map consistency rely on that.

function gauss(x: number, y: number, cx: number, cy: number, sx: number, sy: number): number {
  const dx = (x - cx) / sx;
  const dy = (y - cy) / sy;
  return Math.exp(-(dx * dx + dy * dy) / 2);
}

function localHour(t: Timestamp): number {
  return (t - DAY_START) / HOUR_MS;
}

/** Rough terrain proxy (km): Chuy and Fergana valleys low, Tian Shan high. */
export function elevationKm(lng: number, lat: number): number {
  let e = 3.2;
  e -= 2.4 * gauss(lng, lat, 74.8, 42.9, 1.6, 0.35);
  e -= 2.5 * gauss(lng, lat, 72.0, 40.8, 1.4, 0.6);
  e -= 1.6 * gauss(lng, lat, 77.3, 42.45, 0.9, 0.25);
  e += 0.6 * Math.sin(lng * 1.7) * Math.cos(lat * 2.3);
  return Math.min(4.5, Math.max(0.4, e));
}

export function temperatureAt(lng: number, lat: number, t: Timestamp): number {
  const h = localHour(t);
  const diurnal = 7 * Math.sin((2 * Math.PI * (h - 9)) / 24);
  const warmFront = 2.5 * gauss(lng, lat, 70 + h * 0.4, 41.5, 1.8, 0.9);
  const texture = 0.6 * Math.sin(lng * 7.1 + lat * 3.3);
  return 31 - 6.5 * elevationKm(lng, lat) + diurnal + warmFront + texture;
}

export function insolationAt(lng: number, lat: number, t: Timestamp): number {
  const h = localHour(t);
  const daylight = Math.max(0, Math.sin((Math.PI * (h - 5)) / 15.5));
  const elevation = elevationKm(lng, lat);
  const clouds =
    0.7 * gauss(lng, lat, 71 + 0.35 * h, 41.5 + 0.05 * h, 1.2, 0.6) +
    0.5 * gauss(lng, lat, 77 - 0.2 * h, 42.2, 1.0, 0.5) +
    0.3 * Math.max(0, Math.sin((Math.PI * (h - 11)) / 10)) * (elevation / 4);
  const clearSky = 1000 * daylight ** 1.2 * (1 + 0.05 * elevation);
  return Math.max(0, clearSky * (1 - 0.75 * Math.min(1, clouds)));
}

/** Prevailing westerly + a cyclonic vortex drifting east through the day. */
export function windAt(lng: number, lat: number, t: Timestamp): { u: number; v: number } {
  const h = localHour(t);
  let u = 3 + 2 * Math.sin((2 * Math.PI * (h - 14)) / 24);
  let v = 0.5 * Math.sin(lng * 0.9);

  const cx = 71 + 0.3 * h;
  const cy = 41.8;
  const dx = (lng - cx) * Math.cos((lat * Math.PI) / 180);
  const dy = lat - cy;
  const r = Math.hypot(dx, dy) || 1e-6;
  const radius = 1.3;
  const tangential = 9 * (r / radius) * Math.exp(1 - r / radius);
  u += (-dy / r) * tangential;
  v += (dx / r) * tangential;

  const ridge = 1 + 0.15 * elevationKm(lng, lat);
  return { u: u * ridge, v: v * ridge };
}
