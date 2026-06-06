import { imagesToPdf } from "@/lib/converters/imgToPdf";
import { getExtension, isImageFile, safeBaseName } from "@/lib/converters/shared";

export const pdfEditorInputAccept = "application/pdf,.pdf,image/jpeg,image/png,image/webp,image/gif,.jpg,.jpeg,.png,.webp,.gif";

export function isPDFFile(file: File) {
  return file.type === "application/pdf" || getExtension(file) === "pdf";
}

export function isPDFEditorInput(file: File) {
  return isPDFFile(file) || isImageFile(file);
}

export async function preparePDFEditorInput(file: File) {
  if (isPDFFile(file)) {
    return {
      bytes: await file.arrayBuffer(),
      fileName: file.name.toLowerCase().endsWith(".pdf") ? file.name : `${safeBaseName(file.name)}.pdf`,
      source: "pdf" as const,
    };
  }

  if (isImageFile(file)) {
    const pdfBlob = await imagesToPdf([file]);
    return {
      bytes: await pdfBlob.arrayBuffer(),
      fileName: `${safeBaseName(file.name)}.pdf`,
      source: "image" as const,
    };
  }

  throw new Error("Choose a PDF or image file.");
}

export async function preparePDFEditorInputs(files: File[]) {
  return Promise.all(files.filter(isPDFEditorInput).map((file) => preparePDFEditorInput(file)));
}
