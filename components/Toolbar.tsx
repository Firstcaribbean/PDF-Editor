"use client";

import { ChangeEvent, FormEvent, useEffect, useState } from "react";
import { Bold, ChevronLeft, ChevronRight, Download, FilePlus2, Italic, Minus, Plus, RotateCcw, Strikethrough, Type, Underline } from "lucide-react";
import { PDFUploader } from "@/components/PDFUploader";
import { isPDFEditorInput, pdfEditorInputAccept } from "@/lib/pdfEditorInput";
import type { EditorFontOption, EditorTextBlock } from "@/lib/types";

type ToolbarProps = {
  currentPage: number;
  canDownload: boolean;
  dirtyCount: number;
  fontOptions: EditorFontOption[];
  isExporting: boolean;
  pageCount: number;
  selectedTextBlock: EditorTextBlock | null;
  zoom: number;
  hasMergedPages: boolean;
  onAddPDFs: (files: File[]) => void | Promise<void>;
  onAddText: () => void;
  onDownload: () => void;
  onFile: (file: File) => void | Promise<void>;
  onFormatChange: (
    blockId: string,
    patch: Partial<Pick<EditorTextBlock, "fontName" | "fontFamily" | "fontWeight" | "fontStyle" | "underline" | "strikeThrough">>,
  ) => void;
  onPageChange: (pageIndex: number) => void;
  onResetAll: () => void;
  onZoomChange: (zoom: number) => void;
};

export function Toolbar({
  currentPage,
  canDownload,
  dirtyCount,
  fontOptions,
  isExporting,
  pageCount,
  selectedTextBlock,
  zoom,
  hasMergedPages,
  onAddPDFs,
  onAddText,
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

  const handleAddPDFs = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []).filter(isPDFEditorInput);
    event.target.value = "";

    if (files.length) {
      await onAddPDFs(files);
    }
  };

  const hasSelection = Boolean(selectedTextBlock);
  const selectedBlockId = selectedTextBlock?.id ?? "";
  const isBold = selectedTextBlock ? Number(selectedTextBlock.fontWeight) >= 600 : false;
  const isItalic = selectedTextBlock?.fontStyle === "italic";
  const isUnderline = Boolean(selectedTextBlock?.underline);
  const isStrikeThrough = Boolean(selectedTextBlock?.strikeThrough);
  const selectedFontOption = selectedTextBlock
    ? fontOptions.find((option) => option.fontName === selectedTextBlock.fontName)
    : undefined;

  const handleFontChange = (event: ChangeEvent<HTMLSelectElement>) => {
    const option = fontOptions.find((fontOption) => fontOption.fontName === event.target.value);
    if (!option || !selectedTextBlock) return;

    onFormatChange(selectedTextBlock.id, {
      fontName: option.fontName,
      fontFamily: option.fontFamily,
    });
  };

  return (
    <header className="toolbar">
      <div className="toolbar-group">
        <PDFUploader compact onFile={onFile} disabled={isExporting} />
        <label className="toolbar-file-button" title="Add PDFs or images">
          <FilePlus2 size={17} aria-hidden="true" />
          <span>Add pages</span>
          <input
            type="file"
            accept={pdfEditorInputAccept}
            multiple
            onChange={handleAddPDFs}
            disabled={isExporting}
          />
        </label>
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
          className="icon-button"
          type="button"
          title="Add text"
          aria-label="Add text"
          onClick={onAddText}
          disabled={isExporting}
        >
          <Type size={16} aria-hidden="true" />
        </button>
        <span className="toolbar-divider" />
        <label className="font-select-wrap" title="Font family">
          <span className="sr-only">Font family</span>
          <select
            className="font-select"
            value={selectedTextBlock?.fontName ?? ""}
            onChange={handleFontChange}
            disabled={!hasSelection || isExporting}
            style={{ fontFamily: selectedFontOption?.fontFamily }}
          >
            <option value="" disabled>
              Auto font
            </option>
            {fontOptions.map((option) => (
              <option key={`${option.source}-${option.fontName}`} value={option.fontName} style={{ fontFamily: option.fontFamily }}>
                {option.source === "detected" ? "PDF: " : ""}
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <span className="toolbar-divider" />
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
          {dirtyCount ? `${dirtyCount} edited` : hasMergedPages ? "Ready PDF" : "No edits"}
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
          disabled={!canDownload || isExporting}
        >
          <Download size={17} aria-hidden="true" />
          <span>{isExporting ? "Exporting" : "Download"}</span>
        </button>
      </div>
    </header>
  );
}
