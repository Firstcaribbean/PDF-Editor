"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { PageSidebar } from "@/components/PageSidebar";
import { PDFUploader } from "@/components/PDFUploader";
import { PDFViewer } from "@/components/PDFViewer";
import { Toolbar } from "@/components/Toolbar";
import { usePDFEditor } from "@/hooks/usePDFEditor";
import { createSamplePDFFile } from "@/lib/createSamplePDF";
import { loadStoredPDF, storePDFFile } from "@/lib/fileStore";

function EditorEmptyState({
  isLoading,
  onFile,
  onSample,
}: {
  isLoading: boolean;
  onFile: (file: File) => void | Promise<void>;
  onSample: () => void | Promise<void>;
}) {
  return (
    <main className="editor-empty">
      <div className="brand-row">
        <div className="brand-mark">PDF</div>
        <div>
          <h1>Inline PDF Editor</h1>
          <p>Open a document to begin.</p>
        </div>
      </div>
      <PDFUploader onFile={onFile} disabled={isLoading} />
      <div className="home-actions">
        <button className="secondary-button" type="button" onClick={onSample} disabled={isLoading}>
          Try sample PDF
        </button>
      </div>
    </main>
  );
}

function EditorLoading() {
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

export function PDFEditorClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [hasTriedInitialLoad, setHasTriedInitialLoad] = useState(false);
  const editor = usePDFEditor();
  const { loadBytes, setActivePageIndex } = editor;
  const dirtyCount = editor.dirtyBlocks.length + editor.dirtyImageBlocks.length;
  const hasDirtyEdits = dirtyCount > 0;

  const handleFile = useCallback(
    async (file: File) => {
      const id = await storePDFFile(file);
      router.replace(`/editor?doc=${encodeURIComponent(id)}`);
      await loadBytes(await file.arrayBuffer(), file.name);
    },
    [loadBytes, router],
  );

  const handleSample = useCallback(async () => {
    const file = await createSamplePDFFile();
    await handleFile(file);
  }, [handleFile]);

  useEffect(() => {
    if (hasTriedInitialLoad) return;

    const docId = searchParams.get("doc");
    if (!docId) {
      setHasTriedInitialLoad(true);
      return;
    }

    async function loadInitialDocument(id: string) {
      const record = await loadStoredPDF(id);
      if (record) {
        await loadBytes(record.bytes, record.fileName);
      }
      setHasTriedInitialLoad(true);
    }

    void loadInitialDocument(docId);
  }, [hasTriedInitialLoad, loadBytes, searchParams]);

  useEffect(() => {
    if (!hasDirtyEdits) return;

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [hasDirtyEdits]);

  const goToPage = useCallback(
    (pageIndex: number) => {
      setActivePageIndex(pageIndex);
      requestAnimationFrame(() => {
        document.getElementById(`pdf-page-${pageIndex + 1}`)?.scrollIntoView({
          block: "start",
          behavior: "smooth",
        });
      });
    },
    [setActivePageIndex],
  );

  if (editor.status === "loading" || !hasTriedInitialLoad) {
    return <EditorLoading />;
  }

  if (!editor.documentModel || !editor.pdf) {
    return <EditorEmptyState onFile={handleFile} onSample={handleSample} isLoading={false} />;
  }

  const editableTextCount = editor.documentModel.pages.reduce((total, page) => total + page.textBlocks.length, 0);
  const editableImageCount = editor.documentModel.pages.reduce((total, page) => total + page.imageBlocks.length, 0);
  const editableElementCount = editableTextCount + editableImageCount;

  return (
    <main className="editor-root">
      <Toolbar
        currentPage={editor.activePageIndex}
        dirtyCount={dirtyCount}
        isExporting={editor.isExporting}
        pageCount={editor.documentModel.pageCount}
        selectedTextBlock={editor.selectedTextBlock}
        zoom={editor.zoom}
        onDownload={editor.exportPDF}
        onFile={handleFile}
        onFormatChange={editor.updateBlockFormat}
        onPageChange={goToPage}
        onResetAll={editor.resetAllEdits}
        onZoomChange={editor.setZoom}
      />
      <div className="editor-body">
        <PageSidebar
          activePageIndex={editor.activePageIndex}
          documentModel={editor.documentModel}
          pdf={editor.pdf}
          onPageSelect={goToPage}
        />
        <section className="canvas-workbench" aria-label={editor.documentModel.fileName}>
          <div className="document-meta">
            <div>
              <strong>{editor.documentModel.fileName}</strong>
              <span>
                {editableElementCount
                  ? `${editableTextCount} text blocks, ${editableImageCount} images`
                  : "No editable content detected"}
              </span>
            </div>
            {editor.error ? <p className="field-error">{editor.error}</p> : null}
          </div>
          {editableElementCount ? (
            <PDFViewer
              activePageIndex={editor.activePageIndex}
              documentModel={editor.documentModel}
              pdf={editor.pdf}
              selectedBlockId={editor.selectedBlockId}
              zoom={editor.zoom}
              onActivePageChange={editor.setActivePageIndex}
              onBlockChange={editor.updateBlockText}
              onBlockReset={editor.resetBlock}
              onBlockSelect={editor.setSelectedBlockId}
              onImageReplace={editor.replaceImageBlock}
              onPageBackgrounds={editor.updatePageBackgrounds}
            />
          ) : (
            <div className="no-text-panel">
              <strong>No editable content was found.</strong>
              <span>This document may be scanned or image-only.</span>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
