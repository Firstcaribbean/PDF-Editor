import { orderPoints, Point } from "@/lib/scanner/cornerOrdering";

function distance(a: Point, b: Point) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function interpolate(tl: Point, tr: Point, br: Point, bl: Point, u: number, v: number): Point {
  return {
    x: (1 - u) * (1 - v) * tl.x + u * (1 - v) * tr.x + u * v * br.x + (1 - u) * v * bl.x,
    y: (1 - u) * (1 - v) * tl.y + u * (1 - v) * tr.y + u * v * br.y + (1 - u) * v * bl.y,
  };
}

function drawImageTriangle(
  context: CanvasRenderingContext2D,
  image: HTMLImageElement,
  source: [Point, Point, Point],
  destination: [Point, Point, Point],
) {
  const [s0, s1, s2] = source;
  const [d0, d1, d2] = destination;
  const denominator = s0.x * (s1.y - s2.y) + s1.x * (s2.y - s0.y) + s2.x * (s0.y - s1.y);

  if (Math.abs(denominator) < 0.001) return;

  const a = (d0.x * (s1.y - s2.y) + d1.x * (s2.y - s0.y) + d2.x * (s0.y - s1.y)) / denominator;
  const b = (d0.y * (s1.y - s2.y) + d1.y * (s2.y - s0.y) + d2.y * (s0.y - s1.y)) / denominator;
  const c = (d0.x * (s2.x - s1.x) + d1.x * (s0.x - s2.x) + d2.x * (s1.x - s0.x)) / denominator;
  const d = (d0.y * (s2.x - s1.x) + d1.y * (s0.x - s2.x) + d2.y * (s1.x - s0.x)) / denominator;
  const e =
    (d0.x * (s1.x * s2.y - s2.x * s1.y) +
      d1.x * (s2.x * s0.y - s0.x * s2.y) +
      d2.x * (s0.x * s1.y - s1.x * s0.y)) /
    denominator;
  const f =
    (d0.y * (s1.x * s2.y - s2.x * s1.y) +
      d1.y * (s2.x * s0.y - s0.x * s2.y) +
      d2.y * (s0.x * s1.y - s1.x * s0.y)) /
    denominator;

  context.save();
  context.beginPath();
  context.moveTo(d0.x, d0.y);
  context.lineTo(d1.x, d1.y);
  context.lineTo(d2.x, d2.y);
  context.closePath();
  context.clip();
  context.transform(a, b, c, d, e, f);
  context.drawImage(image, 0, 0);
  context.restore();
}

export async function cropByCorners(image: HTMLImageElement, corners: Point[]) {
  const { topLeft, topRight, bottomRight, bottomLeft } = orderPoints(corners);
  const width = Math.max(1, Math.round(Math.max(distance(topRight, topLeft), distance(bottomRight, bottomLeft))));
  const height = Math.max(1, Math.round(Math.max(distance(bottomLeft, topLeft), distance(bottomRight, topRight))));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas is not available in this browser.");

  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, width, height);

  const grid = 14;
  const overlap = 0.9;

  for (let row = 0; row < grid; row += 1) {
    for (let column = 0; column < grid; column += 1) {
      const u0 = column / grid;
      const v0 = row / grid;
      const u1 = (column + 1) / grid;
      const v1 = (row + 1) / grid;
      const sourceTopLeft = interpolate(topLeft, topRight, bottomRight, bottomLeft, u0, v0);
      const sourceTopRight = interpolate(topLeft, topRight, bottomRight, bottomLeft, u1, v0);
      const sourceBottomRight = interpolate(topLeft, topRight, bottomRight, bottomLeft, u1, v1);
      const sourceBottomLeft = interpolate(topLeft, topRight, bottomRight, bottomLeft, u0, v1);
      const destinationTopLeft = { x: u0 * width - overlap, y: v0 * height - overlap };
      const destinationTopRight = { x: u1 * width + overlap, y: v0 * height - overlap };
      const destinationBottomRight = { x: u1 * width + overlap, y: v1 * height + overlap };
      const destinationBottomLeft = { x: u0 * width - overlap, y: v1 * height + overlap };

      drawImageTriangle(context, image, [sourceTopLeft, sourceTopRight, sourceBottomRight], [destinationTopLeft, destinationTopRight, destinationBottomRight]);
      drawImageTriangle(context, image, [sourceTopLeft, sourceBottomRight, sourceBottomLeft], [destinationTopLeft, destinationBottomRight, destinationBottomLeft]);
    }
  }

  return canvas;
}
