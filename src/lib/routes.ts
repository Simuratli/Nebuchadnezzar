type Coord = [number, number];

const distance = (a: Coord, b: Coord) => Math.hypot(b[0] - a[0], b[1] - a[1]);

/**
 * Returns the part of a line drawn at progress t (0..1). Distance is planar in
 * degrees, which is only used to pace the animation evenly.
 * `passed` is how many of the line's vertices the head has reached.
 */
export function sliceLine(coords: Coord[], t: number): { line: Coord[]; head: Coord; passed: number } {
  const progress = Math.min(1, Math.max(0, t));
  // Summing segments can fall just short of the total, which would miss the last vertex.
  if (progress === 1) return { line: coords, head: coords[coords.length - 1], passed: coords.length };
  const total = coords.slice(1).reduce((sum, c, i) => sum + distance(coords[i], c), 0);
  if (total === 0) return { line: coords.slice(0, 1), head: coords[0], passed: 1 };

  let remaining = progress * total;
  for (let i = 1; i < coords.length; i++) {
    const segment = distance(coords[i - 1], coords[i]);
    if (remaining < segment) {
      const f = remaining / segment;
      const head: Coord = [coords[i - 1][0] + (coords[i][0] - coords[i - 1][0]) * f, coords[i - 1][1] + (coords[i][1] - coords[i - 1][1]) * f];
      return { line: [...coords.slice(0, i), head], head, passed: i };
    }
    remaining -= segment;
  }
  return { line: coords, head: coords[coords.length - 1], passed: coords.length };
}

export function lineBounds(coords: Coord[]): [Coord, Coord] {
  const lngs = coords.map((c) => c[0]);
  const lats = coords.map((c) => c[1]);
  return [
    [Math.min(...lngs), Math.min(...lats)],
    [Math.max(...lngs), Math.max(...lats)],
  ];
}
