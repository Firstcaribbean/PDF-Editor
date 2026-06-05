"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { extractPDFDocument } from "@/lib/extractTextBlocks";
import { rebuildPDF } from "@/lib/rebuildPDF";
import type { EditorDocumentModel, EditorTextBlock, ImageReplacement, RGBColor } from "@/lib/types";

type EditorStatus = "idle" | "loading" | "ready" | "error";

type BackgroundSample = {
  blockId: string;
  color: RGBColor;
};

type TextFormatPatch = Partial<Pick<EditorTextBlock, "fontWeight" | "fontStyle" | "underline" | "strikeThrough">>;

function isTextBlockDirty(block: EditorTextBlock) {
  return (
    block.text !== block.originalText ||
    block.fontWeight !== block.originalFontWeight ||
    block.fontStyle !== block.originalFontStyle ||
    block.underline !== block.originalUnderline ||
    block.strikeThrough !== block.originalStrikeThrough
  );
}

function downloadBytes(bytes: Uint8Array, fileName: string) {
  const buffer = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(buffer).set(bytes);
  const blob = new Blob([buffer], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName.replace(/\.pdf$/i, "") + "-edited.pdf";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export function usePDFEditor() {
  const pdfRef = useRef<any>(null);
  const [documentModel, setDocumentModel] = useState<EditorDocumentModel | null>(null);
  const [status, setStatus] = useState<EditorStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [activePageIndex, setActivePageIndex] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);

  const dirtyBlocks = useMemo(() => {
    return documentModel?.pages.flatMap((page) => page.textBlocks.filter((block) => block.dirty)) ?? [];
  }, [documentModel]);

  const dirtyImageBlocks = useMemo(() => {
    return documentModel?.pages.flatMap((page) => page.imageBlocks.filter((block) => block.dirty)) ?? [];
  }, [documentModel]);

  const selectedTextBlock = useMemo(() => {
    if (!selectedBlockId) return null;
    return documentModel?.pages.flatMap((page) => page.textBlocks).find((block) => block.id === selectedBlockId) ?? null;
  }, [documentModel, selectedBlockId]);

  const loadBytes = useCallback(async (bytes: ArrayBuffer | Uint8Array, fileName: string) => {
    setStatus("loading");
    setError(null);
    setSelectedBlockId(null);
    setActivePageIndex(0);

    try {
      const loaded = await extractPDFDocument(bytes, fileName);
      pdfRef.current = loaded.pdf;
      setDocumentModel(loaded.document);
      setStatus("ready");
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "The PDF could not be opened.";
      setError(message);
      setStatus("error");
    }
  }, []);

  const updateBlockText = useCallback((blockId: string, text: string) => {
    setDocumentModel((current) => {
      if (!current) return current;

      return {
        ...current,
        pages: current.pages.map((page) => ({
          ...page,
          textBlocks: page.textBlocks.map((block) =>
            block.id === blockId
              ? (() => {
                  const updated = { ...block, text };
                  return {
                    ...updated,
                    dirty: isTextBlockDirty(updated),
                  };
                })()
              : block,
          ),
        })),
      };
    });
  }, []);

  const updateBlockFormat = useCallback((blockId: string, patch: TextFormatPatch) => {
    setDocumentModel((current) => {
      if (!current) return current;

      return {
        ...current,
        pages: current.pages.map((page) => ({
          ...page,
          textBlocks: page.textBlocks.map((block) =>
            block.id === blockId
              ? (() => {
                  const updated = { ...block, ...patch };
                  return {
                    ...updated,
                    dirty: isTextBlockDirty(updated),
                  };
                })()
              : block,
          ),
        })),
      };
    });
  }, []);

  const resetBlock = useCallback((blockId: string) => {
    setDocumentModel((current) => {
      if (!current) return current;

      return {
        ...current,
        pages: current.pages.map((page) => ({
          ...page,
          textBlocks: page.textBlocks.map((block) =>
            block.id === blockId
              ? {
                  ...block,
                  text: block.originalText,
                  fontWeight: block.originalFontWeight,
                  fontStyle: block.originalFontStyle,
                  underline: block.originalUnderline,
                  strikeThrough: block.originalStrikeThrough,
                  dirty: false,
                }
              : block,
          ),
        })),
      };
    });
  }, []);

  const replaceImageBlock = useCallback((blockId: string, replacement: ImageReplacement) => {
    setDocumentModel((current) => {
      if (!current) return current;

      return {
        ...current,
        pages: current.pages.map((page) => ({
          ...page,
          imageBlocks: page.imageBlocks.map((block) =>
            block.id === blockId
              ? {
                  ...block,
                  replacement,
                  dirty: true,
                }
              : block,
          ),
        })),
      };
    });
  }, []);

  const resetAllEdits = useCallback(() => {
    setDocumentModel((current) => {
      if (!current) return current;

      return {
        ...current,
        pages: current.pages.map((page) => ({
          ...page,
          textBlocks: page.textBlocks.map((block) => ({
            ...block,
            text: block.originalText,
            fontWeight: block.originalFontWeight,
            fontStyle: block.originalFontStyle,
            underline: block.originalUnderline,
            strikeThrough: block.originalStrikeThrough,
            dirty: false,
          })),
          imageBlocks: page.imageBlocks.map((block) => ({
            ...block,
            replacement: undefined,
            dirty: false,
          })),
        })),
      };
    });
  }, []);

  const updatePageBackgrounds = useCallback((pageIndex: number, samples: BackgroundSample[]) => {
    if (!samples.length) return;

    setDocumentModel((current) => {
      if (!current) return current;

      const sampleMap = new Map(samples.map((sample) => [sample.blockId, sample.color]));
      let changed = false;

      const pages = current.pages.map((page) => {
        if (page.pageIndex !== pageIndex) return page;

        const textBlocks = page.textBlocks.map((block) => {
          const color = sampleMap.get(block.id);
          if (!color) return block;

          const previous = block.backgroundColor;
          const moved =
            Math.abs(previous.red - color.red) > 0.01 ||
            Math.abs(previous.green - color.green) > 0.01 ||
            Math.abs(previous.blue - color.blue) > 0.01;

          if (!moved) return block;
          changed = true;
          return { ...block, backgroundColor: color };
        });

        return changed ? { ...page, textBlocks } : page;
      });

      return changed ? { ...current, pages } : current;
    });
  }, []);

  const exportPDF = useCallback(async () => {
    if (!documentModel || (!dirtyBlocks.length && !dirtyImageBlocks.length)) return;

    setIsExporting(true);
    setError(null);

    try {
      const bytes = await rebuildPDF(documentModel.originalBytes, {
        textBlocks: dirtyBlocks,
        imageBlocks: dirtyImageBlocks,
        fonts: documentModel.fonts,
      });
      downloadBytes(bytes, documentModel.fileName);
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "The PDF could not be exported.";
      setError(message);
    } finally {
      setIsExporting(false);
    }
  }, [dirtyBlocks, dirtyImageBlocks, documentModel]);

  const setZoomClamped = useCallback((nextZoom: number) => {
    setZoom(Math.min(2.5, Math.max(0.55, Number(nextZoom.toFixed(2)))));
  }, []);

  return {
    activePageIndex,
    dirtyBlocks,
    dirtyImageBlocks,
    documentModel,
    error,
    isExporting,
    pdf: pdfRef.current,
    selectedBlockId,
    selectedTextBlock,
    status,
    zoom,
    exportPDF,
    loadBytes,
    replaceImageBlock,
    resetBlock,
    resetAllEdits,
    setActivePageIndex,
    setSelectedBlockId,
    setZoom: setZoomClamped,
    updateBlockText,
    updateBlockFormat,
    updatePageBackgrounds,
  };
}
