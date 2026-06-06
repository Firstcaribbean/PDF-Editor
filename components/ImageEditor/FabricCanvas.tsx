"use client";

import { Upload } from "lucide-react";
import { useRef } from "react";
import { useImageEditor } from "@/hooks/useImageEditor";

export function FabricCanvas({
  editor,
}: {
  editor: ReturnType<typeof useImageEditor>;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);

  return (
    <section className="image-canvas-wrap">
      <div className={`image-empty ${editor.hasImage ? "is-hidden" : ""}`}>
        <button className="tool-dropzone" type="button" onClick={() => inputRef.current?.click()} disabled={!editor.isReady}>
          <Upload size={32} aria-hidden="true" />
          <span>{editor.isReady ? "Upload JPG, PNG, WEBP, or GIF" : "Preparing image editor"}</span>
          <small>The image stays in your browser and becomes the locked base layer.</small>
        </button>
      </div>
      <input
        ref={inputRef}
        className="hidden-input"
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        onChange={(event) => {
          const file = event.currentTarget.files?.[0];
          if (file) void editor.loadImage(file);
          event.currentTarget.value = "";
        }}
      />
      <canvas
        ref={editor.canvasElementRef}
        className={`fabric-canvas tool-${editor.tool}`}
        tabIndex={0}
        onPointerDown={editor.handlePointerDown}
        onPointerMove={editor.handlePointerMove}
        onPointerUp={editor.handlePointerUp}
        onPointerCancel={editor.handlePointerUp}
        onDoubleClick={editor.handleDoubleClick}
        aria-label="Image editing canvas"
      />
    </section>
  );
}
