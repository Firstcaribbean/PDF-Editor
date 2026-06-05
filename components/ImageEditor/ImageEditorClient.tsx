"use client";

import { ExportPanel } from "@/components/ImageEditor/ExportPanel";
import { FabricCanvas } from "@/components/ImageEditor/FabricCanvas";
import { ImageToolbar } from "@/components/ImageEditor/ImageToolbar";
import { useImageEditor } from "@/hooks/useImageEditor";

export function ImageEditorClient() {
  const editor = useImageEditor();

  return (
    <main className="tool-shell editor-tool-shell">
      <section className="tool-header compact-header">
        <div>
          <span className="tool-kicker">Image editor</span>
          <h1>Annotate and export images</h1>
          <p>Add text, drawing, shapes, crop edits, and export to image, PDF, or DOCX.</p>
        </div>
      </section>

      <section className="image-editor-grid">
        <ImageToolbar editor={editor} />
        <FabricCanvas editor={editor} />
        <ExportPanel editor={editor} />
      </section>
    </main>
  );
}
