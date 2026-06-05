"use client";

import { Download, RefreshCw } from "lucide-react";
import { ConversionProgress } from "@/components/Converter/ConversionProgress";
import { DropZone } from "@/components/Converter/DropZone";
import { FormatSelector } from "@/components/Converter/FormatSelector";
import { useConverter } from "@/hooks/useConverter";

export function ConverterClient() {
  const converter = useConverter();

  return (
    <main className="tool-shell">
      <section className="tool-header">
        <div>
          <span className="tool-kicker">Universal converter</span>
          <h1>Convert documents and images in your browser</h1>
          <p>PDF pages, image exports, DOCX text, OCR text, HTML, and ZIP bundles without uploading files to a server.</p>
        </div>
      </section>

      <section className="tool-grid converter-grid">
        <div className="tool-panel">
          <DropZone files={converter.files} onFiles={converter.setFiles} />
        </div>

        <div className="tool-panel">
          <div className="panel-heading">
            <span>Convert to</span>
            {converter.sourceType ? <small>Detected: {converter.sourceType.toUpperCase()}</small> : null}
          </div>
          <FormatSelector targets={converter.targets} value={converter.target} onChange={converter.setTarget} />
          <ConversionProgress progress={converter.progress} status={converter.statusText} />
          {converter.error ? <p className="field-error">{converter.error}</p> : null}
          <div className="button-row">
            <button className="primary-button" type="button" onClick={converter.convert} disabled={!converter.files.length || !converter.target || converter.status === "working"}>
              <RefreshCw size={17} aria-hidden="true" />
              <span>{converter.status === "working" ? "Converting" : "Convert"}</span>
            </button>
            <button className="secondary-button" type="button" onClick={converter.download} disabled={!converter.output}>
              <Download size={17} aria-hidden="true" />
              <span>Download</span>
            </button>
          </div>
          {converter.output ? <p className="muted-status">Ready: {converter.output.fileName}</p> : null}
        </div>
      </section>
    </main>
  );
}
