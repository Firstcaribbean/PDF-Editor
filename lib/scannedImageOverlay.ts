import Tesseract from "tesseract.js";
import { fileToImageCanvas } from "@/lib/converters/shared";
import type { EditorDocumentOverlay, EditorImageBlock, EditorTextBlock } from "@/lib/types";

type BBox = {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
};

type OcrLine = {
  text: string;
  confidence?: number;
  bbox: BBox;
};

const ocrFont = {
  fontName: "standard:Times-Roman",
  fontFamily: '"Times New Roman", Times, serif',
};

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function bboxWidth(bbox: BBox) {
  return Math.max(1, bbox.x1 - bbox.x0);
}

function bboxHeight(bbox: BBox) {
  return Math.max(1, bbox.y1 - bbox.y0);
}

function looksBold(text: string) {
  const letters = text.replace(/[^a-z]/gi, "");
  const uppercaseLetters = text.replace(/[^A-Z]/g, "");

  return text.includes(":") || (letters.length >= 3 && uppercaseLetters.length / letters.length > 0.65);
}

function normalizeOcrText(text: string) {
  return text.replace(/\s+/g, " ").trim();
}

function lineToTextBlock(line: OcrLine, index: number, pageWidth: number, pageHeight: number): EditorTextBlock | null {
  const text = normalizeOcrText(line.text);
  if (!text || text.length < 2) return null;
  if ((line.confidence ?? 80) < 32) return null;

  const left = clamp(line.bbox.x0, 0, pageWidth - 1);
  const top = clamp(line.bbox.y0, 0, pageHeight - 1);
  const width = clamp(bboxWidth(line.bbox), 4, pageWidth - left);
  const height = clamp(bboxHeight(line.bbox), 4, pageHeight - top);
  const fontSize = clamp(height * 0.82, 8, 96);
  const ascent = 0.8;
  const descent = -0.2;

  return {
    id: `p1-ocr-t${index}`,
    pageIndex: 0,
    pageNumber: 1,
    text,
    originalText: text,
    screen: {
      left,
      top,
      width,
      height,
    },
    pdf: {
      x: left,
      y: pageHeight - top - height + fontSize * 0.2,
      width,
      height,
    },
    fontName: ocrFont.fontName,
    originalFontName: ocrFont.fontName,
    fontFamily: ocrFont.fontFamily,
    originalFontFamily: ocrFont.fontFamily,
    fontSize,
    pdfFontSize: fontSize,
    ascent,
    descent,
    horizontalScale: 1,
    fontWeight: looksBold(text) ? "700" : "400",
    originalFontWeight: looksBold(text) ? "700" : "400",
    fontStyle: "normal",
    originalFontStyle: "normal",
    underline: false,
    originalUnderline: false,
    strikeThrough: false,
    originalStrikeThrough: false,
    color: { red: 0.05, green: 0.06, blue: 0.07 },
    backgroundColor: { red: 1, green: 1, blue: 1 },
    rotation: 0,
    dirty: false,
  };
}

function getOcrLines(result: Tesseract.RecognizeResult): OcrLine[] {
  const lines: OcrLine[] = [];

  for (const block of result.data.blocks ?? []) {
    for (const paragraph of block.paragraphs ?? []) {
      for (const line of paragraph.lines ?? []) {
        if (!line.bbox) continue;
        lines.push({
          text: line.text,
          confidence: line.confidence,
          bbox: line.bbox,
        });
      }
    }
  }

  return lines;
}

function isInkPixel(data: Uint8ClampedArray, offset: number) {
  const alpha = data[offset + 3];
  if (alpha < 40) return false;

  const red = data[offset];
  const green = data[offset + 1];
  const blue = data[offset + 2];
  const distanceFromWhite = Math.max(255 - red, 255 - green, 255 - blue);
  const contrast = Math.max(red, green, blue) - Math.min(red, green, blue);

  return distanceFromWhite > 28 || contrast > 24;
}

function componentToImageBlock({
  box,
  index,
  pageHeight,
  pageWidth,
  scale,
}: {
  box: { minX: number; minY: number; maxX: number; maxY: number };
  index: number;
  pageHeight: number;
  pageWidth: number;
  scale: number;
}): EditorImageBlock {
  const padding = 6 / scale;
  const left = clamp(box.minX / scale - padding, 0, pageWidth - 1);
  const top = clamp(box.minY / scale - padding, 0, pageHeight - 1);
  const right = clamp((box.maxX + 1) / scale + padding, left + 1, pageWidth);
  const bottom = clamp((box.maxY + 1) / scale + padding, top + 1, pageHeight);
  const width = right - left;
  const height = bottom - top;

  return {
    id: `p1-ocr-i${index}`,
    pageIndex: 0,
    pageNumber: 1,
    screen: {
      left,
      top,
      width,
      height,
    },
    pdf: {
      x: left,
      y: pageHeight - top - height,
      width,
      height,
    },
    rotation: 0,
    dirty: false,
  };
}

function detectImageRegions(canvas: HTMLCanvasElement): EditorImageBlock[] {
  const maxScanSide = 900;
  const scale = Math.min(1, maxScanSide / Math.max(canvas.width, canvas.height));
  const scanCanvas = document.createElement("canvas");
  scanCanvas.width = Math.max(1, Math.round(canvas.width * scale));
  scanCanvas.height = Math.max(1, Math.round(canvas.height * scale));

  const context = scanCanvas.getContext("2d", { willReadFrequently: true });
  if (!context) return [];

  context.drawImage(canvas, 0, 0, scanCanvas.width, scanCanvas.height);
  const imageData = context.getImageData(0, 0, scanCanvas.width, scanCanvas.height);
  const { data, width, height } = imageData;
  const visited = new Uint8Array(width * height);
  const candidates: Array<{ minX: number; minY: number; maxX: number; maxY: number; pixels: number; density: number }> = [];
  const stack: number[] = [];

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const start = y * width + x;
      if (visited[start] || !isInkPixel(data, start * 4)) continue;

      visited[start] = 1;
      stack.push(start);
      let minX = x;
      let maxX = x;
      let minY = y;
      let maxY = y;
      let pixels = 0;

      while (stack.length) {
        const current = stack.pop()!;
        const cx = current % width;
        const cy = Math.floor(current / width);
        pixels += 1;
        minX = Math.min(minX, cx);
        maxX = Math.max(maxX, cx);
        minY = Math.min(minY, cy);
        maxY = Math.max(maxY, cy);

        for (let ny = Math.max(0, cy - 1); ny <= Math.min(height - 1, cy + 1); ny += 1) {
          for (let nx = Math.max(0, cx - 1); nx <= Math.min(width - 1, cx + 1); nx += 1) {
            const next = ny * width + nx;
            if (visited[next] || !isInkPixel(data, next * 4)) continue;
            visited[next] = 1;
            stack.push(next);
          }
        }
      }

      const boxWidth = maxX - minX + 1;
      const boxHeight = maxY - minY + 1;
      const density = pixels / Math.max(1, boxWidth * boxHeight);
      const originalWidth = boxWidth / scale;
      const originalHeight = boxHeight / scale;
      const originalAreaRatio = (originalWidth * originalHeight) / Math.max(1, canvas.width * canvas.height);
      const aspect = originalWidth / Math.max(1, originalHeight);

      if (
        originalWidth >= 45 &&
        originalHeight >= 45 &&
        originalAreaRatio > 0.002 &&
        originalAreaRatio < 0.25 &&
        density > 0.08 &&
        aspect < 7 &&
        aspect > 0.15
      ) {
        candidates.push({ minX, minY, maxX, maxY, pixels, density });
      }
    }
  }

  return candidates
    .sort((a, b) => b.pixels - a.pixels)
    .slice(0, 10)
    .map((box, index) =>
      componentToImageBlock({
        box,
        index,
        pageHeight: canvas.height,
        pageWidth: canvas.width,
        scale,
      }),
    );
}

export async function createScannedImageOverlay(file: File): Promise<EditorDocumentOverlay> {
  const [canvas, result] = await Promise.all([
    fileToImageCanvas(file, "#ffffff"),
    Tesseract.recognize(file, "eng"),
  ]);

  const textBlocks = getOcrLines(result)
    .map((line, index) => lineToTextBlock(line, index, canvas.width, canvas.height))
    .filter(Boolean) as EditorTextBlock[];

  return {
    pages: [
      {
        pageIndex: 0,
        textBlocks,
        imageBlocks: detectImageRegions(canvas),
      },
    ],
  };
}
