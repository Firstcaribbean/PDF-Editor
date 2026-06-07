import { PDFDocument } from "pdf-lib";
import { canvasToJpegBlob, fileToImageCanvas, ProgressCallback, uint8ArrayToArrayBuffer } from "@/lib/converters/shared";
import { getImagePdfLayout } from "@/lib/imagePdfLayout";

export async function imagesToPdf(files: File[], onProgress?: ProgressCallback) {
  const pdfDoc = await PDFDocument.create();

  for (let index = 0; index < files.length; index += 1) {
    onProgress?.(Math.round((index / Math.max(files.length, 1)) * 80), `Adding image ${index + 1} of ${files.length}`);
    const canvas = await fileToImageCanvas(files[index], "#ffffff");
    const jpegBlob = await canvasToJpegBlob(canvas);
    const jpegBytes = await jpegBlob.arrayBuffer();
    const image = await pdfDoc.embedJpg(jpegBytes);
    const layout = getImagePdfLayout(image.width, image.height);
    const page = pdfDoc.addPage([layout.pageWidth, layout.pageHeight]);
    page.drawImage(image, {
      x: layout.imageLeft,
      y: layout.pageHeight - layout.imageTop - layout.imageHeight,
      width: layout.imageWidth,
      height: layout.imageHeight,
    });
  }

  onProgress?.(90, "Saving PDF");
  const bytes = await pdfDoc.save();
  return new Blob([uint8ArrayToArrayBuffer(bytes)], { type: "application/pdf" });
}
