"use client";

import { Trash2 } from "lucide-react";
import { useScanner } from "@/hooks/useScanner";

export function ScanQueue({
  scanner,
}: {
  scanner: ReturnType<typeof useScanner>;
}) {
  return (
    <aside className="tool-panel scan-queue">
      <div className="panel-heading">
        <span>Pages</span>
        <small>{scanner.queue.length}</small>
      </div>
      <div className="scan-list">
        {scanner.queue.length ? (
          scanner.queue.map((scan, index) => (
            <div key={scan.id} className="scan-thumb">
              <img src={scan.dataUrl} alt={`Scan ${index + 1}`} />
              <span>{index + 1}</span>
              <button type="button" onClick={() => scanner.removeFromQueue(scan.id)} aria-label={`Remove page ${index + 1}`}>
                <Trash2 size={14} aria-hidden="true" />
              </button>
            </div>
          ))
        ) : (
          <p className="muted-status">Add cleaned pages here before exporting a batch.</p>
        )}
      </div>
    </aside>
  );
}
