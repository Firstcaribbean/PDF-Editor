import { getPdfJs } from "@/lib/pdfjs";
import { escapeHtml, ProgressCallback } from "@/lib/converters/shared";

export async function pdfToText(file: File, onProgress?: ProgressCallback) {
  const pdfjs = await getPdfJs();
  const bytes = new Uint8Array(await file.arrayBuffer());
  const pdf = await pdfjs.getDocument({ data: bytes }).promise;
  const pages: string[] = [];

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    onProgress?.(Math.round(((pageNumber - 1) / pdf.numPages) * 88), `Reading page ${pageNumber} of ${pdf.numPages}`);
    const page = await pdf.getPage(pageNumber);
    const content = await page.getTextContent();
    const text = content.items.map((item: { str?: string }) => item.str ?? "").join(" ");
    pages.push(text.trim());
  }

  return pages.join("\n\n");
}

export async function pdfToHtml(file: File, onProgress?: ProgressCallback) {
  const text = await pdfToText(file, onProgress);
  const paragraphs = text
    .split(/\n{2,}/)
    .map((paragraph) => `<p>${escapeHtml(paragraph).replace(/\n/g, "<br />")}</p>`)
    .join("\n");

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(file.name)}</title>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.5; max-width: 760px; margin: 40px auto; padding: 0 24px; }
  </style>
</head>
<body>
${paragraphs || "<p></p>"}
</body>
</html>`;
}
