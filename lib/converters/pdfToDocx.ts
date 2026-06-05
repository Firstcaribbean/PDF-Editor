import { pdfToText } from "@/lib/converters/pdfToTxt";
import { textToDocxBlob } from "@/lib/converters/txtToPdf";
import { ProgressCallback } from "@/lib/converters/shared";

export async function pdfToDocx(file: File, onProgress?: ProgressCallback) {
  const text = await pdfToText(file, onProgress);
  return textToDocxBlob(text);
}
