import { describe, expect, it } from "vitest";
import { lineBounds, sliceLine } from "@/lib/routes";

const line: [number, number][] = [[0, 0], [10, 0], [10, 10]];

describe("sliceLine", () => {
  it("starts at the first vertex", () => {
    const s = sliceLine(line, 0);
    expect(s.head).toEqual([0, 0]);
    expect(s.passed).toBe(1);
  });
  it("interpolates by distance along the line", () => {
    expect(sliceLine(line, 0.25).head).toEqual([5, 0]);
    expect(sliceLine(line, 0.75).head).toEqual([10, 5]);
  });
  it("counts vertices the head has reached", () => {
    expect(sliceLine(line, 0.25).passed).toBe(1);
    expect(sliceLine(line, 0.5).passed).toBe(2);
    expect(sliceLine(line, 1).passed).toBe(3);
  });
  it("returns the whole line at the end and clamps out-of-range progress", () => {
    expect(sliceLine(line, 1).line).toEqual(line);
    expect(sliceLine(line, 5).line).toEqual(line);
    expect(sliceLine(line, -1).head).toEqual([0, 0]);
  });
  it("reaches the last vertex at t=1 despite floating point rounding", () => {
    const real: [number, number][] = [[-5.8, 35.78], [10.18, 36.8], [29.92, 31.2], [31.24, 30.04], [36.29, 33.51], [66.9, 36.76], [77.2, 28.6]];
    expect(sliceLine(real, 1).passed).toBe(real.length);
    expect(sliceLine(real, 1).head).toEqual([77.2, 28.6]);
  });
  it("includes the head as the last drawn point", () => {
    expect(sliceLine(line, 0.75).line).toEqual([[0, 0], [10, 0], [10, 5]]);
  });
  it("handles degenerate lines", () => {
    expect(sliceLine([[1, 1], [1, 1]], 0.5).head).toEqual([1, 1]);
  });
});

describe("lineBounds", () => {
  it("computes the bounding box", () => {
    expect(lineBounds([[5, -1], [-2, 4]])).toEqual([[-2, -1], [5, 4]]);
  });
});
