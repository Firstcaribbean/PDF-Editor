"use client";

import { CornerHandles } from "@/components/Scanner/CornerHandles";
import { useScanner } from "@/hooks/useScanner";

export function EnhancementPreview({
  scanner,
}: {
  scanner: ReturnType<typeof useScanner>;
}) {
  return (
    <div className="scanner-preview-grid">
      <div className="scan-preview-panel">
        <div className="panel-heading">
          <span>Original</span>
          <small>Drag corners</small>
        </div>
        <div className="scan-image-frame">
          {scanner.rawDataUrl ? (
            <>
              <img src={scanner.rawDataUrl} alt="Original scan" />
              <CornerHandles corners={scanner.corners} imageSize={scanner.imageSize} onChange={scanner.updateCorner} />
            </>
          ) : (
            <span className="empty-panel-text">No scan loaded</span>
          )}
        </div>
      </div>

      <div className="scan-preview-panel">
        <div className="panel-heading">
          <span>Cleaned</span>
          <small>{scanner.enhancementMode}</small>
        </div>
        <div className="scan-image-frame">
          {scanner.processedDataUrl ? <img src={scanner.processedDataUrl} alt="Cleaned scan" /> : <span className="empty-panel-text">Process the scan to preview</span>}
        </div>
      </div>
    </div>
  );
}
