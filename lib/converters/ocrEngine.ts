import Tesseract from "tesseract.js";
import { ProgressCallback } from "@/lib/converters/shared";

export async function recognizeImageText(fileOrDataUrl: File | Blob | string, onProgress?: ProgressCallback) {
  const result = await Tesseract.recognize(fileOrDataUrl, "eng", {
    logger(message) {
      if (message.status === "recognizing text") {
        onProgress?.(Math.round((message.progress ?? 0) * 90), "Recognizing text");
      }
    },
  });

  onProgress?.(96, "OCR complete");
  return result.data.text.trim();
}
