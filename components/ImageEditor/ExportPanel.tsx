"use client";

import { Download } from "lucide-react";
import { ImageExportFormat, useImageEditor } from "@/hooks/useImageEditor";

const formats: ImageExportFormat[] = ["png", "jpg", "webp", "pdf", "docx"];

export function ExportPanel({
  editor,
}: {
  editor: ReturnType<typeof useImageEditor>;
}) {
  return (
    <aside className="tool-panel export-panel">
      <div className="panel-heading">
        <span>Export</span>
        <small>{editor.status}</small>
      </div>
      <div className="format-grid compact">
        {formats.map((format) => (
          <button key={format} className="format-button" type="button" onClick={() => editor.exportFile(format)} disabled={!editor.hasImage}>
            {format.toUpperCase()}
          </button>
        ))}
      </div>
      <button className="primary-button" type="button" onClick={() => editor.exportFile("png")} disabled={!editor.hasImage}>
        <Download size={17} aria-hidden="true" />
        <span>Quick PNG</span>
      </button>
      {editor.error ? <p className="field-error">{editor.error}</p> : null}
    </aside>
  );
}
