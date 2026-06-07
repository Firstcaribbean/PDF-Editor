import Tesseract from "tesseract.js";
import { fileToImageCanvas } from "@/lib/converters/shared";
import { getImagePdfLayout, mapImageRectToPdfPage, type ImagePdfLayout } from "@/lib/imagePdfLayout";
import type { EditorDocumentOverlay, EditorImageBlock, EditorTextBlock } from "@/lib/types";

type BBox = {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
};

type OcrBox = {
  text: string;
  confidence?: number;
  bbox: BBox;
  fontName?: string;
};

type OcrVisualMetrics = {
  inkRatio: number;
  darkRatio: number;
};

type OcrPageProfile = {
  medianHeight: number;
  medianInkRatio: number;
};

const ocrFonts = {
  serif: {
    fontName: "standard:Times-Roman",
    fontFamily: '"Times New Roman", Times, Georgia, serif',
  },
  sans: {
    fontName: "standard:Helvetica",
    fontFamily: 'Arial, Helvetica, "Liberation Sans", sans-serif',
  },
  mono: {
    fontName: "standard:Courier",
    fontFamily: '"Courier New", Courier, monospace',
  },
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

function median(values: number[], fallback: number) {
  const sorted = values.filter(Number.isFinite).sort((a, b) => a - b);
  if (!sorted.length) return fallback;

  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

function normalizeOcrText(text: string) {
  return text.replace(/\s+/g, " ").trim();
}

function hasUsefulText(text: string) {
  return /[a-z0-9]/i.test(text);
}

function getOcrFont(box: OcrBox) {
  const hint = `${box.fontName ?? ""} ${box.text}`.toLowerCase();

  if (hint.includes("courier") || hint.includes("mono")) return ocrFonts.mono;
  if (hint.includes("arial") || hint.includes("helvetica") || hint.includes("calibri") || hint.includes("sans")) {
    return ocrFonts.sans;
  }

  return ocrFonts.serif;
}

function getTextVisualMetrics(canvas: HTMLCanvasElement, bbox: BBox): OcrVisualMetrics {
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) return { inkRatio: 0, darkRatio: 0 };

  const left = clamp(Math.floor(bbox.x0), 0, canvas.width - 1);
  const top = clamp(Math.floor(bbox.y0), 0, canvas.height - 1);
  const right = clamp(Math.ceil(bbox.x1), left + 1, canvas.width);
  const bottom = clamp(Math.ceil(bbox.y1), top + 1, canvas.height);
  const width = right - left;
  const height = bottom - top;
  const imageData = context.getImageData(left, top, width, height);
  let inkPixels = 0;
  let darkPixels = 0;

  for (let index = 0; index < imageData.data.length; index += 4) {
    const alpha = imageData.data[index + 3];
    if (alpha < 40) continue;

    const red = imageData.data[index] / 255;
    const green = imageData.data[index + 1] / 255;
    const blue = imageData.data[index + 2] / 255;
    const luminance = 0.2126 * red + 0.7152 * green + 0.0722 * blue;
    const contrast = Math.max(red, green, blue) - Math.min(red, green, blue);

    if (luminance < 0.72 || (contrast > 0.12 && luminance < 0.86)) {
      inkPixels += 1;
    }

    if (luminance < 0.42) {
      darkPixels += 1;
    }
  }

  const area = Math.max(1, width * height);
  return {
    inkRatio: inkPixels / area,
    darkRatio: darkPixels / area,
  };
}

function buildOcrPageProfile(canvas: HTMLCanvasElement, boxes: OcrBox[]): OcrPageProfile {
  const usefulBoxes = boxes.filter((box) => hasUsefulText(normalizeOcrText(box.text)));
  const heights = usefulBoxes.map((box) => bboxHeight(box.bbox));
  const inkRatios = usefulBoxes.map((box) => getTextVisualMetrics(canvas, box.bbox).inkRatio);

  return {
    medianHeight: median(heights, 14),
    medianInkRatio: median(inkRatios, 0.12),
  };
}

function inferOcrFontWeight(text: string, box: OcrBox, metrics: OcrVisualMetrics, profile: OcrPageProfile) {
  const height = bboxHeight(box.bbox);
  const isLargeText = height > profile.medianHeight * 1.14;
  const isInkHeavy = metrics.inkRatio > Math.max(0.14, profile.medianInkRatio * 1.18) || metrics.darkRatio > 0.08;

  if (looksBold(text) || isLargeText || isInkHeavy) return "700";
  return "400";
}

function ocrBoxToTextBlock(
  box: OcrBox,
  index: number,
  layout: ImagePdfLayout,
  profile: OcrPageProfile,
  metrics: OcrVisualMetrics,
): EditorTextBlock | null {
  const text = normalizeOcrText(box.text);
  if (!text || !hasUsefulText(text)) return null;

  const confidence = box.confidence ?? 80;
  const isShortNumber = /^\d{1,2}$/.test(text);
  if (confidence < (isShortNumber ? 10 : 18)) return null;

  const rawPaddingX = Math.max(2, bboxHeight(box.bbox) * 0.12);
  const rawPaddingY = Math.max(2, bboxHeight(box.bbox) * 0.1);
  const mapped = mapImageRectToPdfPage(layout, {
    left: box.bbox.x0 - rawPaddingX,
    top: box.bbox.y0 - rawPaddingY,
    width: bboxWidth(box.bbox) + rawPaddingX * 2,
    height: bboxHeight(box.bbox) + rawPaddingY * 2,
  });
  const contentHeight = bboxHeight(box.bbox) * layout.scale;
  const fontSize = clamp(contentHeight * 1.08, 6, 48);
  const ascent = 0.8;
  const descent = -0.2;
  const font = getOcrFont(box);
  const fontWeight = inferOcrFontWeight(text, box, metrics, profile);

  return {
    id: `p1-ocr-t${index}`,
    pageIndex: 0,
    pageNumber: 1,
    text,
    originalText: text,
    screen: mapped.screen,
    pdf: {
      ...mapped.pdf,
      y: mapped.pdf.y + rawPaddingY * layout.scale + fontSize * 0.08,
    },
    fontName: font.fontName,
    originalFontName: font.fontName,
    fontFamily: font.fontFamily,
    originalFontFamily: font.fontFamily,
    fontSize,
    pdfFontSize: fontSize,
    ascent,
    descent,
    horizontalScale: 1,
    fontWeight,
    originalFontWeight: fontWeight,
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

function getOcrWords(result: Tesseract.RecognizeResult): OcrBox[] {
  const words: OcrBox[] = [];

  for (const block of result.data.blocks ?? []) {
    for (const paragraph of block.paragraphs ?? []) {
      for (const line of paragraph.lines ?? []) {
        for (const word of line.words ?? []) {
          if (!word.bbox) continue;
          words.push({
            text: word.text,
            confidence: word.confidence,
            bbox: word.bbox,
            fontName: word.font_name,
          });
        }
      }
    }
  }

  return words;
}

function parseTsvWords(tsv?: string | null): OcrBox[] {
  if (!tsv) return [];

  const rows = tsv.trim().split(/\r?\n/);
  const header = rows.shift()?.split("\t") ?? [];
  const indexOf = (name: string) => header.indexOf(name);
  const indexes = {
    block: indexOf("block_num"),
    confidence: indexOf("conf"),
    height: indexOf("height"),
    left: indexOf("left"),
    line: indexOf("line_num"),
    paragraph: indexOf("par_num"),
    text: indexOf("text"),
    top: indexOf("top"),
    width: indexOf("width"),
  };

  if (Object.values(indexes).some((index) => index < 0)) return [];

  const words: OcrBox[] = [];

  for (const row of rows) {
    const cells = row.split("\t");
    const text = normalizeOcrText(cells[indexes.text] ?? "");
    const confidence = Number(cells[indexes.confidence]);
    if (!text || !hasUsefulText(text) || confidence < 10) continue;

    const left = Number(cells[indexes.left]);
    const top = Number(cells[indexes.top]);
    const width = Number(cells[indexes.width]);
    const height = Number(cells[indexes.height]);
    if (![left, top, width, height].every(Number.isFinite)) continue;
    if (width <= 0 || height <= 0) continue;

    words.push({
      text,
      confidence,
      bbox: {
        x0: left,
        y0: top,
        x1: left + width,
        y1: top + height,
      },
    });
  }

  return words;
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
  layout,
  scale,
}: {
  box: { minX: number; minY: number; maxX: number; maxY: number };
  index: number;
  layout: ImagePdfLayout;
  scale: number;
}): EditorImageBlock {
  const padding = 6 / scale;
  const left = box.minX / scale - padding;
  const top = box.minY / scale - padding;
  const right = (box.maxX + 1) / scale + padding;
  const bottom = (box.maxY + 1) / scale + padding;
  const mapped = mapImageRectToPdfPage(layout, {
    left,
    top,
    width: right - left,
    height: bottom - top,
  });

  return {
    id: `p1-ocr-i${index}`,
    pageIndex: 0,
    pageNumber: 1,
    screen: mapped.screen,
    pdf: mapped.pdf,
    rotation: 0,
    dirty: false,
  };
}

function detectImageRegions(canvas: HTMLCanvasElement, layout: ImagePdfLayout): EditorImageBlock[] {
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
        density > 0.16 &&
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
        layout,
        scale,
      }),
    );
}

async function recognizeWithLayout(file: File) {
  const worker = await Tesseract.createWorker("eng");

  try {
    await worker.setParameters({
      preserve_interword_spaces: "1",
      tessedit_pageseg_mode: Tesseract.PSM.AUTO,
    });
    return await worker.recognize(
      file,
      {},
      {
        text: true,
        blocks: true,
        tsv: true,
      },
    );
  } finally {
    await worker.terminate();
  }
}

export async function createScannedImageOverlay(file: File): Promise<EditorDocumentOverlay> {
  const [canvas, result] = await Promise.all([
    fileToImageCanvas(file, "#ffffff"),
    recognizeWithLayout(file),
  ]);
  const layout = getImagePdfLayout(canvas.width, canvas.height);
  const ocrWords = getOcrWords(result);
  const words = ocrWords.length ? ocrWords : parseTsvWords(result.data.tsv);
  const profile = buildOcrPageProfile(canvas, words);

  const textBlocks = words
    .map((word, index) => ocrBoxToTextBlock(word, index, layout, profile, getTextVisualMetrics(canvas, word.bbox)))
    .filter(Boolean) as EditorTextBlock[];

  return {
    pages: [
      {
        pageIndex: 0,
        textBlocks,
        imageBlocks: detectImageRegions(canvas, layout),
      },
    ],
  };
}
