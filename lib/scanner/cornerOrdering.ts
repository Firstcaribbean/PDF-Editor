export type Point = {
  x: number;
  y: number;
};

export function orderPoints(points: Point[]) {
  if (points.length !== 4) {
    throw new Error("Four document corners are required.");
  }

  const sortedBySum = [...points].sort((a, b) => a.x + a.y - (b.x + b.y));
  const sortedByDiff = [...points].sort((a, b) => a.y - a.x - (b.y - b.x));

  return {
    topLeft: sortedBySum[0],
    bottomRight: sortedBySum[3],
    topRight: sortedByDiff[0],
    bottomLeft: sortedByDiff[3],
  };
}

export function defaultCorners(width: number, height: number): Point[] {
  const insetX = Math.round(width * 0.06);
  const insetY = Math.round(height * 0.06);

  return [
    { x: insetX, y: insetY },
    { x: width - insetX, y: insetY },
    { x: width - insetX, y: height - insetY },
    { x: insetX, y: height - insetY },
  ];
}
