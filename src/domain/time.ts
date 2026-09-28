export type Timestamp = number;

export const HOUR_MS = 3_600_000;

/**
 * Regular time axis — gridded weather products are published on a fixed
 * cadence, so start/step/count describes a layer's temporal coverage fully.
 */
export interface TimeAxis {
  readonly start: Timestamp;
  readonly stepMs: number;
  readonly count: number;
}

export function axisEnd(axis: TimeAxis): Timestamp {
  return axis.start + (axis.count - 1) * axis.stepMs;
}

export function axisTimes(axis: TimeAxis): Timestamp[] {
  return Array.from({ length: axis.count }, (_, i) => axis.start + i * axis.stepMs);
}

/**
 * "Valid time" semantics: a step stays valid until the next one, so a
 * 3-hourly product resolves 04:00 to 03:00. Outside [start, end + step) the
 * layer has no data for `t`.
 */
export function resolveValidTime(axis: TimeAxis, t: Timestamp): Timestamp | null {
  if (t < axis.start || t >= axisEnd(axis) + axis.stepMs) return null;
  return axis.start + Math.floor((t - axis.start) / axis.stepMs) * axis.stepMs;
}

export function snapToAxis(axis: TimeAxis, t: Timestamp): Timestamp {
  const index = Math.round((t - axis.start) / axis.stepMs);
  const clamped = Math.min(axis.count - 1, Math.max(0, index));
  return axis.start + clamped * axis.stepMs;
}

export function indexOnAxis(axis: TimeAxis, t: Timestamp): number {
  return Math.round((snapToAxis(axis, t) - axis.start) / axis.stepMs);
}

export const DATA_TIME_ZONE = "Asia/Bishkek";

const timeFormatter = new Intl.DateTimeFormat("ru-RU", {
  hour: "2-digit",
  minute: "2-digit",
  timeZone: DATA_TIME_ZONE,
});

const dateFormatter = new Intl.DateTimeFormat("ru-RU", {
  day: "numeric",
  month: "long",
  timeZone: DATA_TIME_ZONE,
});

export function formatTime(t: Timestamp): string {
  return timeFormatter.format(t);
}

export function formatDate(t: Timestamp): string {
  return dateFormatter.format(t);
}

export function formatAxisRange(axis: TimeAxis): string {
  const hours = axis.stepMs / HOUR_MS;
  return `${formatTime(axis.start)}–${formatTime(axisEnd(axis))}, шаг ${hours} ч`;
}
