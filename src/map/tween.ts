function easeInOut(p: number): number {
  return p < 0.5 ? 2 * p * p : 1 - (-2 * p + 2) ** 2 / 2;
}

/** rAF tween; the returned function cancels it so a newer frame can take over mid-flight. */
export function animate(durationMs: number, onFrame: (progress: number) => void): () => void {
  const start = performance.now();
  let handle = requestAnimationFrame(function tick(now) {
    const p = Math.min(1, (now - start) / durationMs);
    onFrame(easeInOut(p));
    if (p < 1) handle = requestAnimationFrame(tick);
  });
  return () => cancelAnimationFrame(handle);
}

export function lerpInto(out: Float32Array, from: Float32Array, to: Float32Array, p: number): void {
  for (let i = 0; i < out.length; i += 1) {
    const a = from[i] ?? 0;
    out[i] = a + ((to[i] ?? a) - a) * p;
  }
}
