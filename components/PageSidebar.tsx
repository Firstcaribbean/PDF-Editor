"use client";

import { useEffect, useRef, useState } from "react";
import type { EditorDocumentModel, EditorPageModel } from "@/lib/types";

type PageSidebarProps = {
  activePageIndex: number;
  documentModel: EditorDocumentModel;
  pdf: any;
  onPageSelect: (pageIndex: number) => void;
};

function PageThumb({
  isActive,
  page,
  pdf,
  onSelect,
}: {
  isActive: boolean;
  page: EditorPageModel;
  pdf: any;
  onSelect: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [rendered, setRendered] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function renderThumb() {
      if (!pdf || !canvasRef.current || rendered) return;

      const pdfPage = await pdf.getPage(page.pageNumber);
      if (cancelled) return;

      const scale = 108 / page.width;
      const viewport = pdfPage.getViewport({ scale });
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
      await pdfPage.render({ canvasContext: context, viewport }).promise;
      setRendered(true);
    }

    void renderThumb();

    return () => {
      cancelled = true;
    };
  }, [page.pageNumber, page.width, pdf, rendered]);

  return (
    <button className={`page-thumb ${isActive ? "is-active" : ""}`} type="button" onClick={onSelect}>
      <canvas ref={canvasRef} aria-hidden="true" />
      <span>Page {page.pageNumber}</span>
    </button>
  );
}

export function PageSidebar({ activePageIndex, documentModel, pdf, onPageSelect }: PageSidebarProps) {
  return (
    <aside className="page-sidebar" aria-label="Pages">
      <div className="sidebar-title">Pages</div>
      <div className="thumb-list">
        {documentModel.pages.map((page) => (
          <PageThumb
            key={`${documentModel.fingerprint ?? documentModel.fileName}-${page.pageNumber}`}
            isActive={activePageIndex === page.pageIndex}
            page={page}
            pdf={pdf}
            onSelect={() => onPageSelect(page.pageIndex)}
          />
        ))}
      </div>
    </aside>
  );
}
