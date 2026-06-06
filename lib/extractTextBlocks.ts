import { inferFontStyle, inferFontWeight, mapPdfFontToWeb } from "@/lib/fontMapper";
import { getPdfJs } from "@/lib/pdfjs";
import type {
  EditorDocumentModel,
  EditorFontResource,
  EditorImageBlock,
  EditorPageModel,
  EditorTextBlock,
} from "@/lib/types";

type ExtractedPDF = {
  pdf: any;
  document: EditorDocumentModel;
};

function cloneBytes(bytes: ArrayBuffer | Uint8Array) {
  if (bytes instanceof Uint8Array) {
    return new Uint8Array(bytes);
  }

  return new Uint8Array(bytes.slice(0));
}

function safeNumber(value: unknown, fallback = 0) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function createBlockId(pageNumber: number, index: number) {
  return `p${pageNumber}-t${index}`;
}

function createImageBlockId(pageNumber: number, index: number) {
  return `p${pageNumber}-i${index}`;
}

function extractRotation(transform: number[]) {
  const radians = Math.atan2(transform[1] ?? 0, transform[0] ?? 1);
  return (radians * 180) / Math.PI;
}

function getFontMetrics(style: Record<string, any>) {
  const rawAscent = safeNumber(style.ascent, Number.NaN);
  const rawDescent = safeNumber(style.descent, Number.NaN);
  const ascent = Number.isFinite(rawAscent) ? rawAscent : Number.isFinite(rawDescent) ? 1 + rawDescent : 0.8;
  const descent = Number.isFinite(rawDescent) ? rawDescent : ascent - 1;

  return {
    ascent,
    descent,
  };
}

function getPdfJsFontObject(page: any, fontName: string) {
  try {
    return page.commonObjs?.get(fontName);
  } catch {
    return undefined;
  }
}

function cloneFontBytes(data: unknown) {
  if (data instanceof Uint8Array) {
    return new Uint8Array(data);
  }

  if (data instanceof ArrayBuffer) {
    return new Uint8Array(data.slice(0));
  }

  return undefined;
}

function getPdfJsFontFamily(page: any, fontName: string, style: Record<string, any>) {
  const fontObject = getPdfJsFontObject(page, fontName);
  return (
    fontObject?.cssFontInfo?.fontFamily ??
    fontObject?.name ??
    fontObject?.loadedName ??
    style.fontFamily ??
    fontObject?.systemFontInfo?.css
  );
}

function registerFontResource(
  fonts: Record<string, EditorFontResource>,
  page: any,
  fontName: string,
  style: Record<string, any>,
) {
  if (!fontName || fonts[fontName]) {
    return;
  }

  const fontObject = getPdfJsFontObject(page, fontName);
  fonts[fontName] = {
    id: fontName,
    cssFamily: getPdfJsFontFamily(page, fontName, style),
    originalName: fontObject?.name,
    fallbackName: fontObject?.fallbackName,
    bytes: cloneFontBytes(fontObject?.data),
  };
}

function inferResolvedFontWeight(fontName: string, style: Record<string, any>, fontObject: any) {
  const cssWeight = style.fontWeight ?? fontObject?.cssFontInfo?.fontWeight;
  const weightText = String(cssWeight ?? "").toLowerCase();

  if (fontObject?.black || weightText.includes("black")) return "800";
  if (fontObject?.bold || weightText.includes("bold")) return "700";

  const numericWeight = Number.parseInt(weightText, 10);
  if (Number.isFinite(numericWeight) && numericWeight >= 100) {
    return String(Math.min(900, Math.max(100, numericWeight)));
  }

  return inferFontWeight(
    `${fontName} ${fontObject?.name ?? ""} ${fontObject?.fallbackName ?? ""} ${style.fontFamily ?? ""}`,
  );
}

function inferResolvedFontStyle(fontName: string, style: Record<string, any>, fontObject: any) {
  const italicAngle = Number(fontObject?.cssFontInfo?.italicAngle ?? style.italicAngle ?? 0);

  if (fontObject?.italic || (Number.isFinite(italicAngle) && italicAngle !== 0)) {
    return "italic";
  }

  return inferFontStyle(
    `${fontName} ${fontObject?.name ?? ""} ${fontObject?.fallbackName ?? ""} ${style.fontFamily ?? ""}`,
  );
}

function boundsFromPoints(points: Array<[number, number]>) {
  const xs = points.map(([x]) => x);
  const ys = points.map(([, y]) => y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);

  return {
    left: minX,
    top: minY,
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY,
  };
}

function transformUnitBounds(matrix: number[], pdfjsLib: any) {
  const points = [
    pdfjsLib.Util.applyTransform([0, 0], matrix),
    pdfjsLib.Util.applyTransform([1, 0], matrix),
    pdfjsLib.Util.applyTransform([0, 1], matrix),
    pdfjsLib.Util.applyTransform([1, 1], matrix),
  ] as Array<[number, number]>;

  return boundsFromPoints(points);
}

async function extractImageBlocks({
  page,
  pageIndex,
  pageNumber,
  viewport,
  pdfjsLib,
}: {
  page: any;
  pageIndex: number;
  pageNumber: number;
  viewport: any;
  pdfjsLib: any;
}): Promise<EditorImageBlock[]> {
  const operatorList = await page.getOperatorList();
  const { OPS } = pdfjsLib;
  const stack: number[][] = [];
  let currentTransform = [1, 0, 0, 1, 0, 0];
  const imageBlocks: EditorImageBlock[] = [];

  operatorList.fnArray.forEach((fn: number, index: number) => {
    const args = operatorList.argsArray[index] ?? [];

    if (fn === OPS.save) {
      stack.push([...currentTransform]);
      return;
    }

    if (fn === OPS.restore) {
      currentTransform = stack.pop() ?? [1, 0, 0, 1, 0, 0];
      return;
    }

    if (fn === OPS.transform && Array.isArray(args) && args.length >= 6) {
      currentTransform = pdfjsLib.Util.transform(currentTransform, args.slice(0, 6));
      return;
    }

    const paintsImage =
      fn === OPS.paintImageXObject ||
      fn === OPS.paintInlineImageXObject ||
      fn === OPS.paintJpegXObject ||
      fn === OPS.paintImageXObjectRepeat ||
      fn === OPS.paintImageMaskXObject;

    if (!paintsImage) return;

    const screenMatrix = pdfjsLib.Util.transform(viewport.transform, currentTransform);
    const screenBounds = transformUnitBounds(screenMatrix, pdfjsLib);
    const pdfBounds = transformUnitBounds(currentTransform, pdfjsLib);

    if (screenBounds.width < 8 || screenBounds.height < 8 || pdfBounds.width <= 0 || pdfBounds.height <= 0) {
      return;
    }

    imageBlocks.push({
      id: createImageBlockId(pageNumber, imageBlocks.length),
      pageIndex,
      pageNumber,
      screen: {
        left: screenBounds.left,
        top: screenBounds.top,
        width: screenBounds.width,
        height: screenBounds.height,
      },
      pdf: {
        x: pdfBounds.x,
        y: pdfBounds.y,
        width: pdfBounds.width,
        height: pdfBounds.height,
      },
      rotation: extractRotation(currentTransform),
      dirty: false,
    });
  });

  return imageBlocks;
}

function extractTextBlock({
  item,
  index,
  page,
  pageIndex,
  pageNumber,
  viewport,
  pdfjsLib,
  styles,
}: {
  item: any;
  index: number;
  page: any;
  pageIndex: number;
  pageNumber: number;
  viewport: any;
  pdfjsLib: any;
  styles: Record<string, any>;
}): EditorTextBlock | null {
  const text = String(item.str ?? "");

  if (!text.trim()) {
    return null;
  }

  const transform = Array.isArray(item.transform) ? item.transform : [1, 0, 0, 1, 0, 0];
  const tx = pdfjsLib.Util.transform(viewport.transform, transform);
  const fontName = String(item.fontName ?? "");
  const fontStyle = styles[fontName] ?? {};
  const fontObject = getPdfJsFontObject(page, fontName);
  const { ascent, descent } = getFontMetrics(fontStyle);
  const screenFontHeight = Math.max(Math.hypot(safeNumber(tx[2]), safeNumber(tx[3])), safeNumber(item.height, 12), 4);
  const screenBoxHeight = Math.max((ascent - descent) * screenFontHeight, screenFontHeight, 4);
  const screenTextScaleX = Math.max(Math.hypot(safeNumber(tx[0]), safeNumber(tx[1])), 0.1);
  const horizontalScale = Math.max(0.1, screenTextScaleX / screenFontHeight);
  const width = Math.max(safeNumber(item.width, text.length * screenFontHeight * 0.45), 2);
  const left = safeNumber(tx[4]);
  const top = safeNumber(tx[5]) - ascent * screenFontHeight;
  const pdfFontSize = Math.max(
    Math.hypot(safeNumber(transform[2]), safeNumber(transform[3])),
    safeNumber(item.height, screenFontHeight),
    4,
  );
  const pdfBoxHeight = Math.max((ascent - descent) * pdfFontSize, pdfFontSize, 4);
  const pdfX = safeNumber(transform[4]);
  const pdfY = safeNumber(transform[5]);
  const pdfFontFamily = getPdfJsFontFamily(page, fontName, fontStyle);
  const fontWeight = inferResolvedFontWeight(fontName, fontStyle, fontObject);
  const fontStyleValue = inferResolvedFontStyle(fontName, fontStyle, fontObject);

  return {
    id: createBlockId(pageNumber, index),
    pageIndex,
    pageNumber,
    text,
    originalText: text,
    screen: {
      left,
      top,
      width,
      height: screenBoxHeight,
    },
    pdf: {
      x: pdfX,
      y: pdfY,
      width,
      height: pdfBoxHeight,
    },
    fontName,
    originalFontName: fontName,
    fontFamily: mapPdfFontToWeb(fontName, pdfFontFamily),
    originalFontFamily: mapPdfFontToWeb(fontName, pdfFontFamily),
    fontSize: screenFontHeight,
    pdfFontSize,
    ascent,
    descent,
    horizontalScale,
    fontWeight,
    originalFontWeight: fontWeight,
    fontStyle: fontStyleValue,
    originalFontStyle: fontStyleValue,
    underline: false,
    originalUnderline: false,
    strikeThrough: false,
    originalStrikeThrough: false,
    color: { red: 0.05, green: 0.06, blue: 0.07 },
    backgroundColor: { red: 1, green: 1, blue: 1 },
    rotation: extractRotation(transform),
    dirty: false,
  };
}

export async function extractPDFDocument(
  bytes: ArrayBuffer | Uint8Array,
  fileName: string,
): Promise<ExtractedPDF> {
  const pdfjsLib = await getPdfJs();
  const originalBytes = cloneBytes(bytes);
  const loadingTask = pdfjsLib.getDocument({
    data: cloneBytes(originalBytes),
    disableFontFace: false,
    useSystemFonts: true,
  });
  const pdf = await loadingTask.promise;
  const pages: EditorPageModel[] = [];
  const fonts: Record<string, EditorFontResource> = {};

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const viewport = page.getViewport({ scale: 1 });
    const textContent = await page.getTextContent();
    for (const item of textContent.items) {
      const fontName = String(item.fontName ?? "");
      registerFontResource(fonts, page, fontName, textContent.styles?.[fontName] ?? {});
    }
    const imageBlocks = await extractImageBlocks({
      page,
      pageIndex: pageNumber - 1,
      pageNumber,
      viewport,
      pdfjsLib,
    });
    const textBlocks = textContent.items
      .map((item: any, index: number) =>
        extractTextBlock({
          item,
          index,
          page,
          pageIndex: pageNumber - 1,
          pageNumber,
          viewport,
          pdfjsLib,
          styles: textContent.styles ?? {},
        }),
      )
      .filter(Boolean) as EditorTextBlock[];

    pages.push({
      pageIndex: pageNumber - 1,
      pageNumber,
      width: viewport.width,
      height: viewport.height,
      rotation: viewport.rotation ?? 0,
      textBlocks,
      imageBlocks,
    });
  }

  return {
    pdf,
    document: {
      fileName,
      originalBytes,
      fingerprint: pdf.fingerprints?.[0],
      pageCount: pdf.numPages,
      fonts,
      pages,
    },
  };
}
