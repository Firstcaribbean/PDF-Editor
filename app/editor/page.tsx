import { Suspense } from "react";
import { PDFEditorClient } from "@/components/PDFEditorClient";

function EditorFallback() {
  return (
    <main className="editor-loading">
      <div className="loading-panel">
        <div className="skeleton skeleton-title" />
        <div className="skeleton skeleton-line" />
        <div className="skeleton skeleton-page" />
      </div>
    </main>
  );
}

export default function EditorPage() {
  return (
    <Suspense fallback={<EditorFallback />}>
      <PDFEditorClient />
    </Suspense>
  );
}
