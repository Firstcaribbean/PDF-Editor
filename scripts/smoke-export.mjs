import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

const greenPixel = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgF/6ZfK7wAAAABJRU5ErkJggg==",
  "base64",
);
const yellowPixel = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/58BAgAJ/wP9Ihtz9wAAAABJRU5ErkJggg==",
  "base64",
);

const originalDoc = await PDFDocument.create();
const page = originalDoc.addPage([300, 300]);
const font = await originalDoc.embedFont(StandardFonts.Helvetica);
const sourceImage = await originalDoc.embedPng(greenPixel);

page.drawText("Original text", {
  x: 40,
  y: 236,
  size: 16,
  font,
  color: rgb(0, 0, 0),
});
page.drawImage(sourceImage, {
  x: 40,
  y: 116,
  width: 80,
  height: 80,
});

const originalBytes = await originalDoc.save();
const editedDoc = await PDFDocument.load(originalBytes);
const editedPage = editedDoc.getPages()[0];
const editedFont = await editedDoc.embedFont(StandardFonts.HelveticaBold);
const replacementImage = await editedDoc.embedPng(yellowPixel);

editedPage.drawRectangle({
  x: 38,
  y: 232,
  width: 110,
  height: 24,
  color: rgb(1, 1, 1),
});
editedPage.drawText("Edited text", {
  x: 40,
  y: 236,
  size: 16,
  font: editedFont,
  color: rgb(0.04, 0.46, 0.43),
});
editedPage.drawImage(replacementImage, {
  x: 40,
  y: 116,
  width: 80,
  height: 80,
});

const editedBytes = await editedDoc.save();
const reloaded = await PDFDocument.load(editedBytes);

if (reloaded.getPageCount() !== 1 || editedBytes.length < originalBytes.length) {
  throw new Error("PDF export smoke test failed.");
}

const outputPath = join(tmpdir(), "inline-pdf-editor-smoke.pdf");
await writeFile(outputPath, editedBytes);
console.log(`PDF export smoke test passed: ${outputPath}`);
