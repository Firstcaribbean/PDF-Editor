"use client";

import { CameraViewfinder } from "@/components/Scanner/CameraViewfinder";
import { EnhancementPreview } from "@/components/Scanner/EnhancementPreview";
import { ScanQueue } from "@/components/Scanner/ScanQueue";
import { ScanToolbar } from "@/components/Scanner/ScanToolbar";
import { useScanner } from "@/hooks/useScanner";

export function ScannerClient() {
  const scanner = useScanner();

  return (
    <main className="tool-shell scanner-shell">
      <section className="tool-header compact-header">
        <div>
          <span className="tool-kicker">Document scanner</span>
          <h1>Capture, clean, and export scans</h1>
          <p>Use the camera or upload a photo, adjust the page corners, clean the background, and export a multi-page PDF or OCR document.</p>
        </div>
      </section>

      <section className="scanner-grid">
        <ScanToolbar scanner={scanner} />
        <div className="scanner-main">
          <CameraViewfinder scanner={scanner} />
          <EnhancementPreview scanner={scanner} />
        </div>
        <ScanQueue scanner={scanner} />
      </section>
    </main>
  );
}
