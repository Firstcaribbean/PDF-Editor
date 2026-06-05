import { docxToText } from "@/lib/converters/docxToHtml";
import { textToPdfBlob } from "@/lib/converters/txtToPdf";

export async function docxToPdf(file: File) {
  const text = await docxToText(file);
  return textToPdfBlob(text, file.name);
}
