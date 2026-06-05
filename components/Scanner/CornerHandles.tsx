"use client";

import { EdgeOverlay } from "@/components/Scanner/EdgeOverlay";
import { Point } from "@/lib/scanner/cornerOrdering";

export function CornerHandles({
  corners,
  imageSize,
  onChange,
}: {
  corners: Point[];
  imageSize: { width: number; height: number };
  onChange: (index: number, point: Point) => void;
}) {
  if (corners.length !== 4) return null;

  const moveCorner = (event: React.PointerEvent<HTMLButtonElement>, index: number) => {
    if (!event.currentTarget.hasPointerCapture(event.pointerId)) return;
    const parent = event.currentTarget.parentElement;
    if (!parent) return;

    const rect = parent.getBoundingClientRect();
    const x = Math.max(0, Math.min(imageSize.width, ((event.clientX - rect.left) / rect.width) * imageSize.width));
    const y = Math.max(0, Math.min(imageSize.height, ((event.clientY - rect.top) / rect.height) * imageSize.height));
    onChange(index, { x, y });
  };

  return (
    <div className="corner-layer">
      <EdgeOverlay corners={corners} width={imageSize.width} height={imageSize.height} />
      {corners.map((corner, index) => (
        <button
          key={index}
          className="corner-handle"
          type="button"
          style={{
            left: `${(corner.x / imageSize.width) * 100}%`,
            top: `${(corner.y / imageSize.height) * 100}%`,
          }}
          onPointerDown={(event) => event.currentTarget.setPointerCapture(event.pointerId)}
          onPointerMove={(event) => moveCorner(event, index)}
          onPointerUp={(event) => event.currentTarget.releasePointerCapture(event.pointerId)}
          aria-label={`Corner ${index + 1}`}
        />
      ))}
    </div>
  );
}
