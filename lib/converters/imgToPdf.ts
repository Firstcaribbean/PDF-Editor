import { PDFDocument } from "pdf-lib";
import { canvasToJpegBlob, fileToImageCanvas, ProgressCallback, uint8ArrayToArrayBuffer } from "@/lib/converters/shared";

export async function imagesToPdf(files: File[], onProgress?: ProgressCallback) {
  const pdfDoc = await PDFDocument.create();

  for (let index = 0; index < files.length; index += 1) {
    onProgress?.(Math.round((index / Math.max(files.length, 1)) * 80), `Adding image ${index + 1} of ${files.length}`);
    const canvas = await fileToImageCanvas(files[index], "#ffffff");
    const jpegBlob = await canvasToJpegBlob(canvas);
    const jpegBytes = await jpegBlob.arrayBuffer();
    const image = await pdfDoc.embedJpg(jpegBytes);
    const page = pdfDoc.addPage([image.width, image.height]);
    page.drawImage(image, { x: 0, y: 0, width: image.width, height: image.height });
  }

  onProgress?.(90, "Saving PDF");
  const bytes = await pdfDoc.save();
  return new Blob([uint8ArrayToArrayBuffer(bytes)], { type: "application/pdf" });
}
