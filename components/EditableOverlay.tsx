"use client";

import { ChangeEvent, ClipboardEvent, KeyboardEvent, PointerEvent, useEffect, useLayoutEffect, useRef } from "react";
import { ImagePlus, Move } from "lucide-react";
import { colorToCss } from "@/lib/fontMapper";
import type { EditorImageBlock, EditorTextBlock, ImageReplacement } from "@/lib/types";

type EditableOverlayProps = {
  blocks: EditorTextBlock[];
  imageBlocks: EditorImageBlock[];
  selectedBlockId: string | null;
  zoom: number;
  onChange: (blockId: string, text: string) => void;
  onMove: (blockId: string, deltaX: number, deltaY: number) => void;
  onImageReplace: (blockId: string, replacement: ImageReplacement) => void;
  onReset: (blockId: string) => void;
  onSelect: (blockId: string | null) => void;
};

function EditableTextBlock({
  block,
  isSelected,
  zoom,
  onChange,
  onMove,
  onReset,
  onSelect,
}: {
  block: EditorTextBlock;
  isSelected: boolean;
  zoom: number;
  onChange: (blockId: string, text: string) => void;
  onMove: (blockId: string, deltaX: number, deltaY: number) => void;
  onReset: (blockId: string) => void;
  onSelect: (blockId: string | null) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ pointerId: number; startX: number; startY: number; moved: boolean } | null>(null);
  const isOcrBlock = block.id.includes("-ocr-");

  useLayoutEffect(() => {
    if (ref.current) {
      ref.current.textContent = block.text;
    }
    // This intentionally syncs only when a different PDF text block is mounted.
    // Adding block.text here would make React rewrite active contenteditable text and move the caret.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [block.id]);

  useEffect(() => {
    if (!ref.current || document.activeElement === ref.current) return;
    if (ref.current.textContent !== block.text) {
      ref.current.textContent = block.text;
    }
  }, [block.dirty, block.text]);

  const handlePaste = (event: ClipboardEvent<HTMLDivElement>) => {
    event.preventDefault();
    const text = event.clipboardData.getData("text/plain");
    document.execCommand("insertText", false, text);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      if (ref.current) {
        ref.current.textContent = block.originalText;
      }
      onReset(block.id);
      ref.current?.blur();
    }

    if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
      event.preventDefault();
      ref.current?.blur();
    }
  };

  const handleMoveStart = (event: PointerEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    dragRef.current = { pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, moved: false };
    event.currentTarget.setPointerCapture(event.pointerId);
    onSelect(block.id);
  };

  const handleMove = (event: PointerEvent<HTMLButtonElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;

    const deltaX = (event.clientX - drag.startX) / zoom;
    const deltaY = (event.clientY - drag.startY) / zoom;
    if (Math.abs(deltaX) < 1 && Math.abs(deltaY) < 1) return;

    drag.moved = true;
    onMove(block.id, deltaX, deltaY);
    drag.startX = event.clientX;
    drag.startY = event.clientY;
  };

  const handleMoveEnd = (event: PointerEvent<HTMLButtonElement>) => {
    if (dragRef.current?.pointerId === event.pointerId) {
      dragRef.current = null;
    }
  };
  const horizontalScale = block.horizontalScale || 1;
  const transform = [
    block.rotation ? `rotate(${block.rotation}deg)` : "",
    Math.abs(horizontalScale - 1) > 0.01 ? `scaleX(${horizontalScale})` : "",
  ]
    .filter(Boolean)
    .join(" ");
  const lineHeight = Math.max(block.screen.height / Math.max(block.fontSize, 1), 1);

  return (
    <>
      <div
        ref={ref}
        className={`editable-block ${isOcrBlock ? "is-ocr" : ""} ${block.text ? "" : "is-deleted"} ${block.dirty ? "is-dirty" : ""} ${isSelected ? "is-selected" : ""}`}
        contentEditable={Boolean(block.text)}
        role="textbox"
        aria-label={`Text on page ${block.pageNumber}`}
        spellCheck={false}
        suppressContentEditableWarning
        onFocus={() => onSelect(block.id)}
        onInput={(event) => onChange(block.id, event.currentTarget.innerText.replace(/\n$/, ""))}
        onPaste={handlePaste}
        onKeyDown={handleKeyDown}
        style={{
          left: `${block.screen.left * zoom}px`,
          top: `${block.screen.top * zoom}px`,
          width: `${Math.max((block.screen.width * zoom) / horizontalScale, 8)}px`,
          height: `${Math.max(block.screen.height * zoom, 8)}px`,
          fontFamily: block.fontFamily,
          fontSize: `${block.fontSize * zoom}px`,
          fontWeight: block.fontWeight,
          fontStyle: block.fontStyle,
          textDecorationLine: [block.underline ? "underline" : "", block.strikeThrough ? "line-through" : ""]
            .filter(Boolean)
            .join(" "),
          textDecorationThickness: `${Math.max(block.fontSize * zoom * 0.06, 0.7)}px`,
          lineHeight,
          transform: transform || undefined,
          transformOrigin: "left top",
          ["--block-color" as string]: colorToCss(block.color),
          ["--block-bg" as string]: colorToCss(block.backgroundColor),
        }}
      />
      {isSelected && block.text ? (
        <button
          className="editable-move-handle"
          type="button"
          title="Move text box"
          aria-label="Move text box"
          onPointerDown={handleMoveStart}
          onPointerMove={handleMove}
          onPointerUp={handleMoveEnd}
          onPointerCancel={handleMoveEnd}
          style={{
            left: `${(block.screen.left + block.screen.width) * zoom + 4}px`,
            top: `${Math.max(0, block.screen.top * zoom - 4)}px`,
          }}
        >
          <Move size={12} aria-hidden="true" />
        </button>
      ) : null}
    </>
  );
}

function fileToDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error);
    reader.onload = () => resolve(String(reader.result));
    reader.readAsDataURL(file);
  });
}

function normalizeImageMime(file: File): ImageReplacement["mimeType"] | null {
  if (file.type === "image/png" || file.name.toLowerCase().endsWith(".png")) return "image/png";
  if (
    file.type === "image/jpeg" ||
    file.name.toLowerCase().endsWith(".jpg") ||
    file.name.toLowerCase().endsWith(".jpeg")
  ) {
    return "image/jpeg";
  }

  return null;
}

function EditableImageBlock({
  block,
  zoom,
  onImageReplace,
}: {
  block: EditorImageBlock;
  zoom: number;
  onImageReplace: (blockId: string, replacement: ImageReplacement) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleImageChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    const mimeType = normalizeImageMime(file);
    if (!mimeType) return;

    const [buffer, dataUrl] = await Promise.all([file.arrayBuffer(), fileToDataUrl(file)]);
    onImageReplace(block.id, {
      bytes: new Uint8Array(buffer),
      dataUrl,
      mimeType,
    });
  };

  return (
    <button
      className={`editable-image-block ${block.dirty ? "is-dirty" : ""}`}
      type="button"
      title="Replace image"
      aria-label={`Replace image on page ${block.pageNumber}`}
      onClick={() => inputRef.current?.click()}
      style={{
        left: `${block.screen.left * zoom}px`,
        top: `${block.screen.top * zoom}px`,
        width: `${Math.max(block.screen.width * zoom, 12)}px`,
        height: `${Math.max(block.screen.height * zoom, 12)}px`,
        transform: block.rotation ? `rotate(${block.rotation}deg)` : undefined,
        transformOrigin: "left bottom",
      }}
    >
      {block.replacement ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={block.replacement.dataUrl} alt="" aria-hidden="true" />
      ) : null}
      <span className="image-replace-glyph">
        <ImagePlus size={18} aria-hidden="true" />
      </span>
      <input ref={inputRef} type="file" accept="image/png,image/jpeg,.png,.jpg,.jpeg" onChange={handleImageChange} />
    </button>
  );
}

export function EditableOverlay({
  blocks,
  imageBlocks,
  selectedBlockId,
  zoom,
  onChange,
  onMove,
  onImageReplace,
  onReset,
  onSelect,
}: EditableOverlayProps) {
  return (
    <div className="editable-overlay" aria-label="Editable content layer">
      {imageBlocks.map((block) => (
        <EditableImageBlock key={block.id} block={block} zoom={zoom} onImageReplace={onImageReplace} />
      ))}
      {blocks.map((block) => (
        <EditableTextBlock
          key={block.id}
          block={block}
          isSelected={selectedBlockId === block.id}
          zoom={zoom}
          onChange={onChange}
          onMove={onMove}
          onReset={onReset}
          onSelect={onSelect}
        />
      ))}
    </div>
  );
}
