import JSZip from "jszip";
import { getPdfJs } from "@/lib/pdfjs";
import { canvasToBlob, ConversionTarget, ProgressCallback } from "@/lib/converters/shared";

export type RenderedPdfPage = {
  blob: Blob;
  pageNumber: number;
  extension: "jpg" | "png" | "webp";
};

export async function pdfToImages(file: File, target: Extract<ConversionTarget, "jpg" | "png" | "webp">, onProgress?: ProgressCallback) {
  const pdfjs = await getPdfJs();
  const bytes = new Uint8Array(await file.arrayBuffer());
  const pdf = await pdfjs.getDocument({ data: bytes }).promise;
  const mimeType = target === "jpg" ? "image/jpeg" : `image/${target}`;
  const pages: RenderedPdfPage[] = [];

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    onProgress?.(Math.round(((pageNumber - 1) / pdf.numPages) * 85), `Rendering page ${pageNumber} of ${pdf.numPages}`);
    const page = await pdf.getPage(pageNumber);
    const viewport = page.getViewport({ scale: 2 });
    const canvas = document.createElement("canvas");
    canvas.width = Math.ceil(viewport.width);
    canvas.height = Math.ceil(viewport.height);
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Canvas is not available in this browser.");

    if (target === "jpg") {
      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, canvas.width, canvas.height);
    }

    await page.render({ canvasContext: context, viewport }).promise;
    pages.push({
      blob: await canvasToBlob(canvas, mimeType, 0.92),
      pageNumber,
      extension: target,
    });
  }

  onProgress?.(96, "Finishing images");
  return pages;
}

export async function pdfImagesToZip(file: File, target: Extract<ConversionTarget, "jpg" | "png" | "webp">, onProgress?: ProgressCallback) {
  const pages = await pdfToImages(file, target, onProgress);
  const zip = new JSZip();

  for (const page of pages) {
    zip.file(`page-${String(page.pageNumber).padStart(3, "0")}.${page.extension}`, page.blob);
  }

  return zip.generateAsync({ type: "blob" });
}
