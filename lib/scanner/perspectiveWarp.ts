import { Point } from "@/lib/scanner/cornerOrdering";

export async function cropByCorners(image: HTMLImageElement, corners: Point[]) {
  const minX = Math.max(0, Math.min(...corners.map((corner) => corner.x)));
  const minY = Math.max(0, Math.min(...corners.map((corner) => corner.y)));
  const maxX = Math.min(image.naturalWidth, Math.max(...corners.map((corner) => corner.x)));
  const maxY = Math.min(image.naturalHeight, Math.max(...corners.map((corner) => corner.y)));
  const width = Math.max(1, Math.round(maxX - minX));
  const height = Math.max(1, Math.round(maxY - minY));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas is not available in this browser.");

  context.drawImage(image, minX, minY, width, height, 0, 0, width, height);
  return canvas;
}
