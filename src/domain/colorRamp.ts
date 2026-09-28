export type ColorStop = readonly [value: number, color: string];

/** Stops in ascending value order; shared by the map style, the legend and the 3D model. */
export type ColorRamp = readonly ColorStop[];

export function rampToCssGradient(ramp: ColorRamp): string {
  const first = ramp[0]?.[0] ?? 0;
  const last = ramp[ramp.length - 1]?.[0] ?? 1;
  const span = last - first || 1;
  const stops = ramp.map(([value, color]) => `${color} ${(((value - first) / span) * 100).toFixed(1)}%`);
  return `linear-gradient(to right, ${stops.join(", ")})`;
}
