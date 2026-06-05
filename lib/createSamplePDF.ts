import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

function bytesToBlobPart(bytes: Uint8Array) {
  const buffer = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(buffer).set(bytes);
  return buffer;
}

async function createSampleImageBytes() {
  const canvas = document.createElement("canvas");
  canvas.width = 480;
  canvas.height = 260;
  const context = canvas.getContext("2d");

  if (!context) {
    return new Uint8Array();
  }

  context.fillStyle = "#0b766e";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = "#f7d36b";
  context.fillRect(34, 34, canvas.width - 68, canvas.height - 68);
  context.fillStyle = "#111510";
  context.font = "700 42px Arial";
  context.fillText("Replace me", 118, 145);

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((result) => {
      if (result) resolve(result);
      else reject(new Error("Could not generate sample image."));
    }, "image/png");
  });

  return new Uint8Array(await blob.arrayBuffer());
}

export async function createSamplePDFFile() {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([612, 792]);
  const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const sampleImage = await pdfDoc.embedPng(await createSampleImageBytes());

  page.drawText("Inline PDF Editor Sample", {
    x: 72,
    y: 710,
    size: 28,
    font: helveticaBold,
    color: rgb(0.06, 0.07, 0.05),
  });
  page.drawText("Click this sentence and edit it in place.", {
    x: 72,
    y: 654,
    size: 16,
    font: helvetica,
    color: rgb(0.06, 0.07, 0.05),
  });
  page.drawText("Only changed text blocks are redrawn on export.", {
    x: 72,
    y: 626,
    size: 13,
    font: helvetica,
    color: rgb(0.22, 0.26, 0.22),
  });
  page.drawRectangle({
    x: 68,
    y: 332,
    width: 360,
    height: 204,
    color: rgb(0.95, 0.97, 0.94),
  });
  page.drawImage(sampleImage, {
    x: 84,
    y: 350,
    width: 328,
    height: 176,
  });
  page.drawText("Click the image to replace it with a PNG or JPEG.", {
    x: 72,
    y: 294,
    size: 13,
    font: helvetica,
    color: rgb(0.22, 0.26, 0.22),
  });

  const bytes = await pdfDoc.save();
  return new File([bytesToBlobPart(bytes)], "inline-pdf-editor-sample.pdf", {
    type: "application/pdf",
  });
}
