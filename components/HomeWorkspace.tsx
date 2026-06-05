"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { PDFUploader } from "@/components/PDFUploader";
import { createSamplePDFFile } from "@/lib/createSamplePDF";
import { storePDFFile } from "@/lib/fileStore";

export function HomeWorkspace() {
  const router = useRouter();
  const [isOpening, setIsOpening] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFile = async (file: File) => {
    setIsOpening(true);
    setError(null);

    try {
      const id = await storePDFFile(file);
      router.push(`/editor?doc=${encodeURIComponent(id)}`);
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "The PDF could not be opened.";
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
          <div className="brand-mark">PDF</div>
          <div>
            <h1>Inline PDF Editor</h1>
            <p>Private, client-side PDF edits.</p>
          </div>
        </div>
        <PDFUploader onFile={handleFile} disabled={isOpening} />
        <div className="home-actions">
          <button className="secondary-button" type="button" onClick={handleSample} disabled={isOpening}>
            Try sample PDF
          </button>
        </div>
        {isOpening ? <p className="muted-status">Preparing editor...</p> : null}
        {error ? <p className="field-error">{error}</p> : null}
      </section>
    </main>
  );
}
