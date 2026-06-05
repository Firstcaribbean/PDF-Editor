"use client";

import { useEffect, useRef, useState } from "react";
import { EditableOverlay } from "@/components/EditableOverlay";
import type { EditorDocumentModel, EditorPageModel, EditorTextBlock, ImageReplacement, RGBColor } from "@/lib/types";

type PDFViewerProps = {
  activePageIndex: number;
  documentModel: EditorDocumentModel;
  pdf: any;
  selectedBlockId: string | null;
  zoom: number;
  onActivePageChange: (pageIndex: number) => void;
  onBlockChange: (blockId: string, text: string) => void;
  onBlockReset: (blockId: string) => void;
  onBlockSelect: (blockId: string | null) => void;
  onImageReplace: (blockId: string, replacement: ImageReplacement) => void;
  onPageBackgrounds: (pageIndex: number, samples: Array<{ blockId: string; color: RGBColor }>) => void;
};

function sampleBackground(canvas: HTMLCanvasElement, block: EditorTextBlock, zoom: number): RGBColor {
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) return { red: 1, green: 1, blue: 1 };

  const displayWidth = Number.parseFloat(canvas.style.width || String(canvas.width));
  const displayHeight = Number.parseFloat(canvas.style.height || String(canvas.height));
  const scaleX = canvas.width / displayWidth;
  const scaleY = canvas.height / displayHeight;
  const left = Math.max(0, Math.floor(block.screen.left * zoom * scaleX));
  const top = Math.max(0, Math.floor(block.screen.top * zoom * scaleY));
  const width = Math.max(1, Math.floor(block.screen.width * zoom * scaleX));
  const height = Math.max(1, Math.floor(block.screen.height * zoom * scaleY));
  const samples: Array<{ red: number; green: number; blue: number; luminance: number }> = [];
  const inset = Math.max(3, Math.floor(4 * scaleY));
  const sampleCount = 9;

  for (let step = 0; step < sampleCount; step += 1) {
    const ratio = step / (sampleCount - 1);
    const x = left + Math.floor(width * ratio);
    const y = top + Math.floor(height * ratio);
    const points: Array<[number, number]> = [
      [x, top - inset],
      [x, top + height + inset],
      [left - inset, y],
      [left + width + inset, y],
    ];

    for (const [rawX, rawY] of points) {
      const clampedX = Math.max(0, Math.min(canvas.width - 1, Math.floor(rawX)));
      const clampedY = Math.max(0, Math.min(canvas.height - 1, Math.floor(rawY)));
      const data = context.getImageData(clampedX, clampedY, 1, 1).data;
      const red = data[0] / 255;
      const green = data[1] / 255;
      const blue = data[2] / 255;
      samples.push({
        red,
        green,
        blue,
        luminance: 0.2126 * red + 0.7152 * green + 0.0722 * blue,
      });
    }
  }

  if (!samples.length) return { red: 1, green: 1, blue: 1 };

  samples.sort((a, b) => b.luminance - a.luminance);
  const backgroundSamples = samples.slice(0, Math.max(3, Math.ceil(samples.length * 0.35)));
  let red = 0;
  let green = 0;
  let blue = 0;

  for (const sample of backgroundSamples) {
    red += sample.red;
    green += sample.green;
    blue += sample.blue;
  }

  const count = backgroundSamples.length;

  return {
    red: red / count,
    green: green / count,
    blue: blue / count,
  };
}

function PageCanvas({
  activePageIndex,
  page,
  pdf,
  selectedBlockId,
  shouldRender,
  zoom,
  onActivePageChange,
  onBlockChange,
  onBlockReset,
  onBlockSelect,
  onImageReplace,
  onPageBackgrounds,
}: {
  activePageIndex: number;
  page: EditorPageModel;
  pdf: any;
  selectedBlockId: string | null;
  shouldRender: boolean;
  zoom: number;
  onActivePageChange: (pageIndex: number) => void;
  onBlockChange: (blockId: string, text: string) => void;
  onBlockReset: (blockId: string) => void;
  onBlockSelect: (blockId: string | null) => void;
  onImageReplace: (blockId: string, replacement: ImageReplacement) => void;
  onPageBackgrounds: (pageIndex: number, samples: Array<{ blockId: string; color: RGBColor }>) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pageRef = useRef<HTMLDivElement>(null);
  const textBlocksRef = useRef(page.textBlocks);
  const [isRendered, setIsRendered] = useState(false);

  useEffect(() => {
    textBlocksRef.current = page.textBlocks;
  }, [page.textBlocks]);

  useEffect(() => {
    const node = pageRef.current;
    if (!node) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && entry.intersectionRatio > 0.35) {
          onActivePageChange(page.pageIndex);
        }
      },
      { threshold: [0.35, 0.6, 0.85] },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [onActivePageChange, page.pageIndex]);

  useEffect(() => {
    let cancelled = false;
    let renderTask: any;

    async function renderPage() {
      if (!pdf || !canvasRef.current || !shouldRender) return;

      setIsRendered(false);
      const pdfPage = await pdf.getPage(page.pageNumber);
      if (cancelled) return;

      const viewport = pdfPage.getViewport({ scale: zoom });
      const canvas = canvasRef.current;
      const context = canvas.getContext("2d", { alpha: false });
      if (!context) return;

      const outputScale = window.devicePixelRatio || 1;
      canvas.width = Math.floor(viewport.width * outputScale);
      canvas.height = Math.floor(viewport.height * outputScale);
      canvas.style.width = `${viewport.width}px`;
      canvas.style.height = `${viewport.height}px`;
      context.setTransform(outputScale, 0, 0, outputScale, 0, 0);
      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, viewport.width, viewport.height);

      renderTask = pdfPage.render({ canvasContext: context, viewport });
      await renderTask.promise;

      if (cancelled) return;
      setIsRendered(true);
      const samples = textBlocksRef.current.map((block) => ({
        blockId: block.id,
        color: sampleBackground(canvas, block, zoom),
      }));
      onPageBackgrounds(page.pageIndex, samples);
    }

    void renderPage();

    return () => {
      cancelled = true;
      if (renderTask) {
        try {
          renderTask.cancel();
        } catch {
          // PDF.js can throw if the task has already completed.
        }
      }
    };
  }, [onPageBackgrounds, page.pageIndex, page.pageNumber, pdf, shouldRender, zoom]);

  return (
    <section
      id={`pdf-page-${page.pageNumber}`}
      ref={pageRef}
      className={`pdf-page-frame ${activePageIndex === page.pageIndex ? "is-active" : ""}`}
      style={{
        width: `${page.width * zoom}px`,
        height: `${page.height * zoom}px`,
      }}
    >
      {!isRendered ? <div className="page-render-skeleton" /> : null}
      <canvas ref={canvasRef} className="pdf-canvas" aria-label={`Page ${page.pageNumber}`} />
      {isRendered ? (
        <EditableOverlay
          blocks={page.textBlocks}
          imageBlocks={page.imageBlocks}
          selectedBlockId={selectedBlockId}
          zoom={zoom}
          onChange={onBlockChange}
          onImageReplace={onImageReplace}
          onReset={onBlockReset}
          onSelect={onBlockSelect}
        />
      ) : null}
    </section>
  );
}

export function PDFViewer({
  activePageIndex,
  documentModel,
  pdf,
  selectedBlockId,
  zoom,
  onActivePageChange,
  onBlockChange,
  onBlockReset,
  onBlockSelect,
  onImageReplace,
  onPageBackgrounds,
}: PDFViewerProps) {
  return (
    <div className="document-stack">
      {documentModel.pages.map((page) => (
        <PageCanvas
          key={`${documentModel.fingerprint ?? documentModel.fileName}-${page.pageNumber}`}
          activePageIndex={activePageIndex}
          page={page}
          pdf={pdf}
          selectedBlockId={selectedBlockId}
          shouldRender={Math.abs(activePageIndex - page.pageIndex) <= 1}
          zoom={zoom}
          onActivePageChange={onActivePageChange}
          onBlockChange={onBlockChange}
          onBlockReset={onBlockReset}
          onBlockSelect={onBlockSelect}
          onImageReplace={onImageReplace}
          onPageBackgrounds={onPageBackgrounds}
        />
      ))}
    </div>
  );
}
