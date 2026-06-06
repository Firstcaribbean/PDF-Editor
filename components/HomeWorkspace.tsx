"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { useState } from "react";
import { Camera, FileText, ImageIcon, RefreshCw } from "lucide-react";
import { PDFUploader } from "@/components/PDFUploader";
import { createSamplePDFFile } from "@/lib/createSamplePDF";
import { storePDFBytes } from "@/lib/fileStore";
import { preparePDFEditorInput } from "@/lib/pdfEditorInput";

const tools = [
  {
    href: "/editor",
    title: "PDF Editor",
    description: "Edit text and replace images inline while preserving the original page layout.",
    icon: FileText,
  },
  {
    href: "/editor",
    title: "Image Editor",
    description: "Open images as PDF pages, add text, replace images, and download as one PDF.",
    icon: ImageIcon,
  },
  {
    href: "/convert",
    title: "File Converter",
    description: "Convert PDFs, images, DOCX, TXT, HTML, and ZIP bundles locally.",
    icon: RefreshCw,
  },
  {
    href: "/scanner",
    title: "Document Scanner",
    description: "Capture or upload paper documents, clean them, OCR them, and export.",
    icon: Camera,
  },
];

export function HomeWorkspace() {
  const router = useRouter();
  const [isOpening, setIsOpening] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFile = async (file: File) => {
    setIsOpening(true);
    setError(null);

    try {
      const prepared = await preparePDFEditorInput(file);
      const id = await storePDFBytes(prepared.bytes, prepared.fileName, { downloadable: prepared.source === "image" });
      router.push(`/editor?doc=${encodeURIComponent(id)}`);
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "The file could not be opened.";
      setError(message);
      setIsOpening(false);
    }
  };

  const handleSample = async () => {
    const file = await createSamplePDFFile();
    await handleFile(file);
  };

  return (
    <main className="home-shell">
      <section className="home-workspace" aria-label="PDF upload">
        <div className="brand-row">
          <div className="brand-mark">DT</div>
          <div>
            <h1>DocToolkit</h1>
            <p>PDF editor, image editor, converter, and scanner. Everything stays in your browser.</p>
          </div>
        </div>

        <div className="tool-card-grid">
          {tools.map((tool) => {
            const Icon = tool.icon;
            return (
              <Link key={tool.href} className="tool-card" href={tool.href}>
                <Icon size={22} aria-hidden="true" />
                <strong>{tool.title}</strong>
                <span>{tool.description}</span>
              </Link>
            );
          })}
        </div>

        <div className="quick-upload-panel">
          <div className="panel-heading">
            <span>Quick PDF edit</span>
            <small>Open PDFs or images in the inline editor</small>
          </div>
          <PDFUploader onFile={handleFile} disabled={isOpening} />
          <div className="home-actions">
            <button className="secondary-button" type="button" onClick={handleSample} disabled={isOpening}>
              Try sample PDF
            </button>
          </div>
        </div>
        {isOpening ? <p className="muted-status">Preparing editor...</p> : null}
        {error ? <p className="field-error">{error}</p> : null}
      </section>
    </main>
  );
}
