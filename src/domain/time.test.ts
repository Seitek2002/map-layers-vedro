import { describe, expect, it } from "vitest";
import { HOUR_MS, resolveValidTime, snapToAxis, type TimeAxis } from "./time";

const start = Date.UTC(2026, 5, 20, 18);
const at = (hour: number) => start + hour * HOUR_MS;
const threeHourly: TimeAxis = { start, stepMs: 3 * HOUR_MS, count: 8 };
const daylight: TimeAxis = { start: at(5), stepMs: HOUR_MS, count: 16 };

describe("resolveValidTime", () => {
  it("resolves to the latest step at or before t", () => {
    expect(resolveValidTime(threeHourly, at(3))).toBe(at(3));
    expect(resolveValidTime(threeHourly, at(4))).toBe(at(3));
    expect(resolveValidTime(threeHourly, at(5))).toBe(at(3));
    expect(resolveValidTime(threeHourly, at(6))).toBe(at(6));
  });

  it("keeps the last step valid for one step length, then has no data", () => {
    expect(resolveValidTime(threeHourly, at(23))).toBe(at(21));
    expect(resolveValidTime(daylight, at(20))).toBe(at(20));
    expect(resolveValidTime(daylight, at(21))).toBeNull();
  });

  it("has no data before the axis starts", () => {
    expect(resolveValidTime(daylight, at(4))).toBeNull();
  });
});

describe("snapToAxis", () => {
  it("clamps to the axis and rounds to the nearest step", () => {
    expect(snapToAxis(threeHourly, at(-5))).toBe(at(0));
    expect(snapToAxis(threeHourly, at(40))).toBe(at(21));
    expect(snapToAxis(threeHourly, at(4))).toBe(at(3));
    expect(snapToAxis(threeHourly, at(5))).toBe(at(6));
  });
});
