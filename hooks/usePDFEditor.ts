"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { PDFDocument } from "pdf-lib";
import { extractPDFDocument } from "@/lib/extractTextBlocks";
import { rebuildPDF } from "@/lib/rebuildPDF";
import { preparePDFEditorInputs } from "@/lib/pdfEditorInput";
import type { EditorDocumentModel, EditorFontOption, EditorPageModel, EditorTextBlock, ImageReplacement, RGBColor } from "@/lib/types";

type EditorStatus = "idle" | "loading" | "ready" | "error";

type BackgroundSample = {
  blockId: string;
  color: RGBColor;
};

type TextFormatPatch = Partial<
  Pick<EditorTextBlock, "fontName" | "fontFamily" | "fontWeight" | "fontStyle" | "underline" | "strikeThrough">
>;

const loadedFontFaces = new Set<string>();

const standardFontOptions: EditorFontOption[] = [
  {
    fontName: "standard:Helvetica",
    fontFamily: 'Arial, Helvetica, "Liberation Sans", sans-serif',
    label: "Helvetica / Arial",
    source: "standard",
  },
  {
    fontName: "standard:Times-Roman",
    fontFamily: '"Times New Roman", Times, serif',
    label: "Times New Roman",
    source: "standard",
  },
  {
    fontName: "standard:Courier",
    fontFamily: '"Courier New", Courier, monospace',
    label: "Courier New",
    source: "standard",
  },
];

function isTextBlockDirty(block: EditorTextBlock) {
  return (
    block.text !== block.originalText ||
    block.fontName !== block.originalFontName ||
    block.fontFamily !== block.originalFontFamily ||
    block.fontWeight !== block.originalFontWeight ||
    block.fontStyle !== block.originalFontStyle ||
    block.underline !== block.originalUnderline ||
    block.strikeThrough !== block.originalStrikeThrough
  );
}

function isInsertedTextBlock(block: EditorTextBlock) {
  return block.originalText === "" && block.id.includes("-new-");
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

function copyBytesToArrayBuffer(bytes: Uint8Array) {
  const buffer = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(buffer).set(bytes);
  return buffer;
}

function quoteFontFamily(fontFamily: string) {
  return `"${fontFamily.replace(/["\\]/g, "")}"`;
}

function makeRuntimeFontFamily(document: EditorDocumentModel, fontName: string) {
  const seed = `${document.fingerprint ?? document.fileName}-${fontName}`;
  return `PDF_${seed.replace(/[^a-zA-Z0-9_-]/g, "_")}`;
}

async function registerEmbeddedFonts(document: EditorDocumentModel) {
  if (typeof window === "undefined" || typeof FontFace === "undefined" || !("fonts" in window.document)) {
    return document;
  }

  const fontStacks = new Map<string, string>();

  await Promise.all(
    Object.entries(document.fonts).map(async ([fontName, resource]) => {
      if (!resource.bytes?.length) return;

      const runtimeFamily = makeRuntimeFontFamily(document, fontName);
      const cssRuntimeFamily = quoteFontFamily(runtimeFamily);

      try {
        if (!loadedFontFaces.has(runtimeFamily)) {
          const fontFace = new FontFace(runtimeFamily, copyBytesToArrayBuffer(resource.bytes));
          await fontFace.load();
          window.document.fonts.add(fontFace);
          loadedFontFaces.add(runtimeFamily);
        }

        const fallbackStack = resource.cssFamily?.trim() || "Arial, Helvetica, sans-serif";
        fontStacks.set(fontName, `${cssRuntimeFamily}, ${fallbackStack}`);
      } catch {
        fontStacks.set(fontName, resource.cssFamily?.trim() || "Arial, Helvetica, sans-serif");
      }
    }),
  );

  if (!fontStacks.size) return document;

  return {
    ...document,
    fonts: Object.fromEntries(
      Object.entries(document.fonts).map(([fontName, resource]) => [
        fontName,
        fontStacks.has(fontName) ? { ...resource, cssFamily: fontStacks.get(fontName) } : resource,
      ]),
    ),
    pages: document.pages.map((page) => ({
      ...page,
      textBlocks: page.textBlocks.map((block) => {
        const fontFamily = fontStacks.get(block.fontName);
        return fontFamily
          ? {
              ...block,
              fontFamily,
              originalFontFamily: fontFamily,
            }
          : block;
      }),
    })),
  } satisfies EditorDocumentModel;
}

function cleanFontLabel(value: string) {
  return value
    .replace(/^[A-Z]{6}\+/, "")
    .replace(/^PDF_/, "")
    .replace(/["']/g, "")
    .replace(/\s*,\s*(serif|sans-serif|monospace).*$/i, "")
    .replace(/[-_]+/g, " ")
    .trim();
}

function getFontLabel(block: EditorTextBlock, document: EditorDocumentModel) {
  const resource = document.fonts[block.fontName];
  return (
    cleanFontLabel(resource?.originalName ?? "") ||
    cleanFontLabel(resource?.fallbackName ?? "") ||
    cleanFontLabel(resource?.cssFamily ?? "") ||
    cleanFontLabel(block.originalFontFamily) ||
    cleanFontLabel(block.fontName) ||
    "Detected font"
  );
}

function buildFontOptions(document: EditorDocumentModel | null): EditorFontOption[] {
  if (!document) return standardFontOptions;

  const seen = new Set<string>();
  const detected: EditorFontOption[] = [];

  for (const block of document.pages.flatMap((page) => page.textBlocks)) {
    if (seen.has(block.originalFontName)) continue;
    seen.add(block.originalFontName);
    detected.push({
      fontName: block.originalFontName,
      fontFamily: block.originalFontFamily,
      label: getFontLabel(block, document),
      source: "detected",
    });
  }

  return [...detected.sort((a, b) => a.label.localeCompare(b.label)), ...standardFontOptions];
}

function createInsertedTextBlock(page: EditorPageModel): EditorTextBlock {
  const font = standardFontOptions[0];
  const fontSize = Math.max(14, Math.min(28, page.width / 24));
  const ascent = 0.8;
  const descent = -0.2;
  const left = Math.max(24, page.width * 0.12);
  const top = Math.max(24, page.height * 0.12);
  const text = "New text";

  return {
    id: `p${page.pageNumber}-new-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    pageIndex: page.pageIndex,
    pageNumber: page.pageNumber,
    text,
    originalText: "",
    screen: {
      left,
      top,
      width: Math.max(120, text.length * fontSize * 0.62),
      height: fontSize * 1.2,
    },
    pdf: {
      x: left,
      y: page.height - top - ascent * fontSize,
      width: Math.max(120, text.length * fontSize * 0.62),
      height: fontSize,
    },
    fontName: font.fontName,
    originalFontName: font.fontName,
    fontFamily: font.fontFamily,
    originalFontFamily: font.fontFamily,
    fontSize,
    pdfFontSize: fontSize,
    ascent,
    descent,
    horizontalScale: 1,
    fontWeight: "400",
    originalFontWeight: "400",
    fontStyle: "normal",
    originalFontStyle: "normal",
    underline: false,
    originalUnderline: false,
    strikeThrough: false,
    originalStrikeThrough: false,
    color: { red: 0.05, green: 0.06, blue: 0.07 },
    backgroundColor: { red: 1, green: 1, blue: 1 },
    rotation: 0,
    dirty: true,
  };
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
  const [hasMergedPages, setHasMergedPages] = useState(false);

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

  const fontOptions = useMemo(() => buildFontOptions(documentModel), [documentModel]);

  const loadBytes = useCallback(async (bytes: ArrayBuffer | Uint8Array, fileName: string, options?: { downloadable?: boolean }) => {
    setStatus("loading");
    setError(null);
    setSelectedBlockId(null);
    setActivePageIndex(0);
    setHasMergedPages(Boolean(options?.downloadable));

    try {
      const loaded = await extractPDFDocument(bytes, fileName);
      const documentWithFonts = await registerEmbeddedFonts(loaded.document);
      pdfRef.current = loaded.pdf;
      setDocumentModel(documentWithFonts);
      setStatus("ready");
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "The PDF could not be opened.";
      setError(message);
      setStatus("error");
    }
  }, []);

  const loadMergedDocument = useCallback(async (bytes: Uint8Array, fileName: string) => {
    const loaded = await extractPDFDocument(bytes, fileName);
    const documentWithFonts = await registerEmbeddedFonts(loaded.document);
    pdfRef.current = loaded.pdf;
    setDocumentModel(documentWithFonts);
    setSelectedBlockId(null);
    setActivePageIndex(0);
    setHasMergedPages(true);
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
          textBlocks: page.textBlocks.flatMap((block) => {
            if (block.id !== blockId) return [block];
            if (isInsertedTextBlock(block)) return [];

            return [
              {
                ...block,
                text: block.originalText,
                fontName: block.originalFontName,
                fontFamily: block.originalFontFamily,
                fontWeight: block.originalFontWeight,
                fontStyle: block.originalFontStyle,
                underline: block.originalUnderline,
                strikeThrough: block.originalStrikeThrough,
                dirty: false,
              },
            ];
          }),
        })),
      };
    });
    setSelectedBlockId(null);
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
          textBlocks: page.textBlocks
            .filter((block) => !isInsertedTextBlock(block))
            .map((block) => ({
              ...block,
              text: block.originalText,
              fontName: block.originalFontName,
              fontFamily: block.originalFontFamily,
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
    setSelectedBlockId(null);
  }, []);

  const addTextBlock = useCallback(() => {
    let nextBlockId: string | null = null;

    setDocumentModel((current) => {
      if (!current) return current;

      const targetPage = current.pages[activePageIndex] ?? current.pages[0];
      if (!targetPage) return current;

      const block = createInsertedTextBlock(targetPage);
      nextBlockId = block.id;

      return {
        ...current,
        pages: current.pages.map((page) =>
          page.pageIndex === targetPage.pageIndex
            ? {
                ...page,
                textBlocks: [...page.textBlocks, block],
              }
            : page,
        ),
      };
    });

    if (nextBlockId) {
      setSelectedBlockId(nextBlockId);
    }
  }, [activePageIndex]);

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
    if (!documentModel || (!dirtyBlocks.length && !dirtyImageBlocks.length && !hasMergedPages)) return;

    setIsExporting(true);
    setError(null);

    try {
      const bytes =
        dirtyBlocks.length || dirtyImageBlocks.length
          ? await rebuildPDF(documentModel.originalBytes, {
              textBlocks: dirtyBlocks,
              imageBlocks: dirtyImageBlocks,
              fonts: documentModel.fonts,
            })
          : documentModel.originalBytes;
      downloadBytes(bytes, documentModel.fileName);
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "The PDF could not be exported.";
      setError(message);
    } finally {
      setIsExporting(false);
    }
  }, [dirtyBlocks, dirtyImageBlocks, documentModel, hasMergedPages]);

  const appendPDFs = useCallback(
    async (files: File[]) => {
      if (!documentModel || !files.length) return;

      setStatus("loading");
      setError(null);

      try {
        const currentBytes =
          dirtyBlocks.length || dirtyImageBlocks.length
            ? await rebuildPDF(documentModel.originalBytes, {
                textBlocks: dirtyBlocks,
                imageBlocks: dirtyImageBlocks,
                fonts: documentModel.fonts,
              })
            : documentModel.originalBytes;
        const mergedDoc = await PDFDocument.create();
        const preparedFiles = await preparePDFEditorInputs(files);
        if (!preparedFiles.length) {
          throw new Error("Choose PDF or image files to add.");
        }
        const sourceByteSets = [currentBytes, ...preparedFiles.map((file) => file.bytes)];

        for (const sourceBytes of sourceByteSets) {
          const sourceDoc = await PDFDocument.load(sourceBytes);
          const pageIndexes = sourceDoc.getPageIndices();
          const copiedPages = await mergedDoc.copyPages(sourceDoc, pageIndexes);
          copiedPages.forEach((page) => mergedDoc.addPage(page));
        }

        const mergedBytes = await mergedDoc.save();
        const baseName = documentModel.fileName.replace(/\.pdf$/i, "");
        const suffix = preparedFiles.length === 1 ? "plus-1-page" : `plus-${preparedFiles.length}-files`;
        await loadMergedDocument(mergedBytes, `${baseName}-${suffix}.pdf`);
        setStatus("ready");
      } catch (caught) {
        const message = caught instanceof Error ? caught.message : "The files could not be added.";
        setError(message);
        setStatus("error");
      }
    },
    [dirtyBlocks, dirtyImageBlocks, documentModel, loadMergedDocument],
  );

  const setZoomClamped = useCallback((nextZoom: number) => {
    setZoom(Math.min(2.5, Math.max(0.55, Number(nextZoom.toFixed(2)))));
  }, []);

  return {
    activePageIndex,
    dirtyBlocks,
    dirtyImageBlocks,
    documentModel,
    error,
    hasMergedPages,
    isExporting,
    fontOptions,
    pdf: pdfRef.current,
    selectedBlockId,
    selectedTextBlock,
    status,
    zoom,
    addTextBlock,
    exportPDF,
    appendPDFs,
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
