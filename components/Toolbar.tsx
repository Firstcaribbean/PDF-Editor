"use client";

import { ChangeEvent, FormEvent, useEffect, useState } from "react";
import { Bold, ChevronLeft, ChevronRight, Download, Italic, Minus, Plus, RotateCcw, Strikethrough, Underline } from "lucide-react";
import { PDFUploader } from "@/components/PDFUploader";
import type { EditorTextBlock } from "@/lib/types";

type ToolbarProps = {
  currentPage: number;
  dirtyCount: number;
  isExporting: boolean;
  pageCount: number;
  selectedTextBlock: EditorTextBlock | null;
  zoom: number;
  onDownload: () => void;
  onFile: (file: File) => void | Promise<void>;
  onFormatChange: (
    blockId: string,
    patch: Partial<Pick<EditorTextBlock, "fontWeight" | "fontStyle" | "underline" | "strikeThrough">>,
  ) => void;
  onPageChange: (pageIndex: number) => void;
  onResetAll: () => void;
  onZoomChange: (zoom: number) => void;
};

export function Toolbar({
  currentPage,
  dirtyCount,
  isExporting,
  pageCount,
  selectedTextBlock,
  zoom,
  onDownload,
  onFile,
  onFormatChange,
  onPageChange,
  onResetAll,
  onZoomChange,
}: ToolbarProps) {
  const [pageInput, setPageInput] = useState(String(currentPage + 1));

  useEffect(() => {
    setPageInput(String(currentPage + 1));
  }, [currentPage]);

  const submitPage = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextPage = Math.max(1, Math.min(pageCount, Number(pageInput) || 1));
    onPageChange(nextPage - 1);
    setPageInput(String(nextPage));
  };

  const handlePageInput = (event: ChangeEvent<HTMLInputElement>) => {
    setPageInput(event.target.value);
  };
  const hasSelection = Boolean(selectedTextBlock);
  const selectedBlockId = selectedTextBlock?.id ?? "";
  const isBold = selectedTextBlock ? Number(selectedTextBlock.fontWeight) >= 600 : false;
  const isItalic = selectedTextBlock?.fontStyle === "italic";
  const isUnderline = Boolean(selectedTextBlock?.underline);
  const isStrikeThrough = Boolean(selectedTextBlock?.strikeThrough);

  return (
    <header className="toolbar">
      <div className="toolbar-group">
        <PDFUploader compact onFile={onFile} disabled={isExporting} />
        <span className="toolbar-divider" />
        <button
          className="icon-button"
          type="button"
          title="Previous page"
          aria-label="Previous page"
          onClick={() => onPageChange(Math.max(0, currentPage - 1))}
          disabled={currentPage <= 0}
        >
          <ChevronLeft size={17} aria-hidden="true" />
        </button>
        <form className="page-form" onSubmit={submitPage}>
          <input
            aria-label="Current page"
            value={pageInput}
            onBlur={() => setPageInput(String(currentPage + 1))}
            onChange={handlePageInput}
          />
          <span>/ {pageCount}</span>
        </form>
        <button
          className="icon-button"
          type="button"
          title="Next page"
          aria-label="Next page"
          onClick={() => onPageChange(Math.min(pageCount - 1, currentPage + 1))}
          disabled={currentPage >= pageCount - 1}
        >
          <ChevronRight size={17} aria-hidden="true" />
        </button>
      </div>

      <div className="toolbar-group toolbar-center">
        <button
          className={`icon-button ${isBold ? "is-active" : ""}`}
          type="button"
          title="Bold"
          aria-label="Bold"
          aria-pressed={isBold}
          onClick={() => onFormatChange(selectedBlockId, { fontWeight: isBold ? "400" : "700" })}
          disabled={!hasSelection || isExporting}
        >
          <Bold size={16} aria-hidden="true" />
        </button>
        <button
          className={`icon-button ${isItalic ? "is-active" : ""}`}
          type="button"
          title="Italic"
          aria-label="Italic"
          aria-pressed={isItalic}
          onClick={() => onFormatChange(selectedBlockId, { fontStyle: isItalic ? "normal" : "italic" })}
          disabled={!hasSelection || isExporting}
        >
          <Italic size={16} aria-hidden="true" />
        </button>
        <button
          className={`icon-button ${isUnderline ? "is-active" : ""}`}
          type="button"
          title="Underline"
          aria-label="Underline"
          aria-pressed={isUnderline}
          onClick={() => onFormatChange(selectedBlockId, { underline: !isUnderline })}
          disabled={!hasSelection || isExporting}
        >
          <Underline size={16} aria-hidden="true" />
        </button>
        <button
          className={`icon-button ${isStrikeThrough ? "is-active" : ""}`}
          type="button"
          title="Strikethrough"
          aria-label="Strikethrough"
          aria-pressed={isStrikeThrough}
          onClick={() => onFormatChange(selectedBlockId, { strikeThrough: !isStrikeThrough })}
          disabled={!hasSelection || isExporting}
        >
          <Strikethrough size={16} aria-hidden="true" />
        </button>
        <span className="toolbar-divider" />
        <button
          className="icon-button"
          type="button"
          title="Zoom out"
          aria-label="Zoom out"
          onClick={() => onZoomChange(zoom - 0.1)}
        >
          <Minus size={16} aria-hidden="true" />
        </button>
        <span className="zoom-readout">{Math.round(zoom * 100)}%</span>
        <button
          className="icon-button"
          type="button"
          title="Zoom in"
          aria-label="Zoom in"
          onClick={() => onZoomChange(zoom + 0.1)}
        >
          <Plus size={16} aria-hidden="true" />
        </button>
      </div>

      <div className="toolbar-group toolbar-end">
        <span className={`dirty-pill ${dirtyCount ? "is-dirty" : ""}`}>
          {dirtyCount ? `${dirtyCount} edited` : "No edits"}
        </span>
        <button
          className="icon-button"
          type="button"
          title="Reset edits"
          aria-label="Reset edits"
          onClick={onResetAll}
          disabled={!dirtyCount || isExporting}
        >
          <RotateCcw size={16} aria-hidden="true" />
        </button>
        <button
          className="primary-button"
          type="button"
          onClick={onDownload}
          disabled={!dirtyCount || isExporting}
        >
          <Download size={17} aria-hidden="true" />
          <span>{isExporting ? "Exporting" : "Download"}</span>
        </button>
      </div>
    </header>
  );
}
