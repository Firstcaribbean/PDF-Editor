"use client";

import { Point } from "@/lib/scanner/cornerOrdering";

export function EdgeOverlay({
  corners,
  width,
  height,
}: {
  corners: Point[];
  width: number;
  height: number;
}) {
  if (corners.length !== 4) return null;

  const points = corners.map((corner) => `${(corner.x / width) * 100},${(corner.y / height) * 100}`).join(" ");

  return (
    <svg className="edge-overlay" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
      <polygon points={points} />
    </svg>
  );
}
