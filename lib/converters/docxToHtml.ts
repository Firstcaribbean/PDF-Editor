import mammoth from "mammoth";
import { fileToText } from "@/lib/converters/shared";

export async function docxToHtml(file: File) {
  const result = await mammoth.convertToHtml({ arrayBuffer: await file.arrayBuffer() });
  return result.value;
}

export async function docxToText(file: File) {
  if (file.type === "text/plain") return fileToText(file);
  const result = await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() });
  return result.value;
}
