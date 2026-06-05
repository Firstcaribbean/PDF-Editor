"use client";

import { Camera, Download, FilePlus2, Play, ScanLine, Upload } from "lucide-react";
import { useRef } from "react";
import { useScanner } from "@/hooks/useScanner";
import { EnhancementMode } from "@/lib/scanner/imageEnhancement";

const modes: EnhancementMode[] = ["auto", "bw", "grayscale", "color", "photo"];

export function ScanToolbar({
  scanner,
}: {
  scanner: ReturnType<typeof useScanner>;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);

  return (
    <aside className="tool-panel scan-toolbar">
      <div className="panel-heading">
        <span>Scanner</span>
        <small>{scanner.status}</small>
      </div>

      <input
        ref={inputRef}
        className="hidden-input"
        type="file"
        accept="image/jpeg,image/png,image/webp"
        onChange={(event) => {
          const file = event.currentTarget.files?.[0];
          if (file) void scanner.loadImage(file);
        }}
      />

      <div className="button-row wrap">
        <button className="secondary-button" type="button" onClick={() => inputRef.current?.click()}>
          <Upload size={17} aria-hidden="true" />
          <span>Upload</span>
        </button>
        <button className="secondary-button" type="button" onClick={scanner.isCameraActive ? scanner.stopCamera : scanner.startCamera}>
          <Camera size={17} aria-hidden="true" />
          <span>{scanner.isCameraActive ? "Stop" : "Camera"}</span>
        </button>
        <button className="secondary-button" type="button" onClick={scanner.capturePhoto} disabled={!scanner.isCameraActive}>
          <ScanLine size={17} aria-hidden="true" />
          <span>Snap</span>
        </button>
      </div>

      <label className="field-row stacked">
        <span>Enhancement</span>
        <select value={scanner.enhancementMode} onChange={(event) => scanner.setEnhancementMode(event.currentTarget.value as EnhancementMode)}>
          {modes.map((mode) => (
            <option key={mode} value={mode}>
              {mode === "bw" ? "Black & White" : mode[0].toUpperCase() + mode.slice(1)}
            </option>
          ))}
        </select>
      </label>

      <button className="primary-button" type="button" onClick={scanner.processScan} disabled={!scanner.rawDataUrl || scanner.isProcessing}>
        <Play size={17} aria-hidden="true" />
        <span>{scanner.isProcessing ? "Cleaning" : "Clean Scan"}</span>
      </button>
      <button className="secondary-button" type="button" onClick={scanner.addToQueue} disabled={!scanner.rawDataUrl && !scanner.processedDataUrl}>
        <FilePlus2 size={17} aria-hidden="true" />
        <span>Add Page</span>
      </button>

      <div className="format-grid compact">
        <button className="format-button" type="button" onClick={scanner.exportPDF} disabled={!scanner.queue.length && !scanner.rawDataUrl}>
          <Download size={15} aria-hidden="true" />
          PDF
        </button>
        <button className="format-button" type="button" onClick={() => scanner.exportText("docx")} disabled={!scanner.queue.length && !scanner.rawDataUrl}>
          DOCX
        </button>
        <button className="format-button" type="button" onClick={() => scanner.exportText("txt")} disabled={!scanner.queue.length && !scanner.rawDataUrl}>
          TXT
        </button>
      </div>

      {scanner.error ? <p className="field-error">{scanner.error}</p> : null}
    </aside>
  );
}
