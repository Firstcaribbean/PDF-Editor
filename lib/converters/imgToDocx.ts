import { Document, ImageRun, Packer, Paragraph } from "docx";
import { canvasToBlob, fileToImageCanvas, ProgressCallback } from "@/lib/converters/shared";

export async function imagesToDocx(files: File[], onProgress?: ProgressCallback) {
  const children: Paragraph[] = [];

  for (let index = 0; index < files.length; index += 1) {
    onProgress?.(Math.round((index / Math.max(files.length, 1)) * 80), `Embedding image ${index + 1} of ${files.length}`);
    const canvas = await fileToImageCanvas(files[index]);
    const width = Math.min(620, canvas.width);
    const height = Math.round((canvas.height / canvas.width) * width);
    const pngBlob = await canvasToBlob(canvas, "image/png");

    children.push(
      new Paragraph({
        children: [
          new ImageRun({
            type: "png",
            data: await pngBlob.arrayBuffer(),
            transformation: { width, height },
          }),
        ],
      }),
    );
  }

  const document = new Document({
    sections: [{ children }],
  });

  onProgress?.(92, "Saving DOCX");
  return Packer.toBlob(document);
}
