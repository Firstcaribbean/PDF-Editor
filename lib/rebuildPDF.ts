import fontkit from "@pdf-lib/fontkit";
import { PDFDocument, degrees, rgb } from "pdf-lib";
import { mapToStandardPdfFont } from "@/lib/fontMapper";
import type { EditorFontResource, EditorImageBlock, EditorTextBlock, RGBColor } from "@/lib/types";

function normalizeColor(color: RGBColor) {
  return rgb(
    Math.max(0, Math.min(1, color.red)),
    Math.max(0, Math.min(1, color.green)),
    Math.max(0, Math.min(1, color.blue)),
  );
}

function normalizeLines(text: string) {
  return text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
}

function drawTextDecorations({
  block,
  color,
  fontSize,
  page,
  textWidth,
}: {
  block: EditorTextBlock;
  color: ReturnType<typeof rgb>;
  fontSize: number;
  page: ReturnType<PDFDocument["getPages"]>[number];
  textWidth: number;
}) {
  const thickness = Math.max(fontSize * 0.055, 0.5);
  const decorations = [
    {
      enabled: block.underline,
      y: block.pdf.y - fontSize * 0.13,
    },
    {
      enabled: block.strikeThrough,
      y: block.pdf.y + fontSize * 0.32,
    },
  ];

  decorations.forEach((decoration) => {
    if (!decoration.enabled) return;

    page.drawRectangle({
      x: block.pdf.x,
      y: decoration.y,
      width: textWidth,
      height: thickness,
      color,
      rotate: degrees(block.rotation),
    });
  });
}

type RebuildPDFInput = {
  textBlocks: EditorTextBlock[];
  imageBlocks: EditorImageBlock[];
  fonts: Record<string, EditorFontResource>;
};

export async function rebuildPDF(originalBytes: Uint8Array, edits: RebuildPDFInput) {
  const pdfDoc = await PDFDocument.load(originalBytes);
  const pages = pdfDoc.getPages();
  const fontCache = new Map<string, Awaited<ReturnType<typeof pdfDoc.embedFont>>>();
  let fontkitRegistered = false;

  for (const block of edits.textBlocks) {
    const page = pages[block.pageIndex];
    if (!page) continue;

    const fontResource = edits.fonts[block.fontName];
    const fontStyleChanged = block.fontWeight !== block.originalFontWeight || block.fontStyle !== block.originalFontStyle;
    const canUseOriginalFont = Boolean(fontResource?.bytes?.length) && !fontStyleChanged;
    const cacheKey = canUseOriginalFont
      ? `embedded:${block.fontName}`
      : `standard:${block.fontName}:${block.fontWeight}:${block.fontStyle}`;
    let font = fontCache.get(cacheKey);

    if (!font) {
      if (canUseOriginalFont && fontResource?.bytes?.length) {
        try {
          if (!fontkitRegistered) {
            pdfDoc.registerFontkit(fontkit);
            fontkitRegistered = true;
          }
          font = await pdfDoc.embedFont(fontResource.bytes, { subset: true });
        } catch {
          font = undefined;
        }
      }

      if (!font) {
        const standardFont = mapToStandardPdfFont(
          `${block.fontName} ${block.fontFamily} ${fontResource?.originalName ?? ""} ${fontResource?.fallbackName ?? ""}`,
          block.fontWeight,
          block.fontStyle,
        );
        font = await pdfDoc.embedFont(standardFont);
      }

      fontCache.set(cacheKey, font);
    }

    const background = normalizeColor(block.backgroundColor);
    const textColor = normalizeColor(block.color);
    const fontSize = block.pdfFontSize || block.pdf.height;
    const ascent = Number.isFinite(block.ascent) ? block.ascent : 0.8;
    const descent = Number.isFinite(block.descent) ? block.descent : -0.2;
    const textBoxHeight = Math.max((ascent - descent) * fontSize, fontSize);
    const paddingX = Math.max(fontSize * 0.025, 0.25);
    const paddingY = Math.max(fontSize * 0.045, 0.5);
    const eraseWidth = Math.max(
      block.pdf.width,
      font.widthOfTextAtSize(block.originalText, fontSize),
      font.widthOfTextAtSize(block.text, fontSize),
    );

    page.drawRectangle({
      x: block.pdf.x - paddingX,
      y: block.pdf.y + descent * fontSize - paddingY,
      width: eraseWidth + paddingX * 2,
      height: textBoxHeight + paddingY * 2,
      color: background,
      opacity: 1,
      rotate: degrees(block.rotation),
    });

    const lineHeight = fontSize * 1.15;
    normalizeLines(block.text).forEach((line, lineIndex) => {
      const lineY = block.pdf.y - lineIndex * lineHeight;
      const lineWidth = font.widthOfTextAtSize(line || " ", fontSize);
      page.drawText(line || " ", {
        x: block.pdf.x,
        y: lineY,
        size: fontSize,
        font,
        color: textColor,
        lineHeight,
        rotate: degrees(block.rotation),
      });

      drawTextDecorations({
        block: {
          ...block,
          pdf: {
            ...block.pdf,
            y: lineY,
          },
        },
        color: textColor,
        fontSize,
        page,
        textWidth: lineWidth,
      });
    });
  }

  for (const block of edits.imageBlocks) {
    const page = pages[block.pageIndex];
    const replacement = block.replacement;
    if (!page || !replacement) continue;

    const image =
      replacement.mimeType === "image/png"
        ? await pdfDoc.embedPng(replacement.bytes)
        : await pdfDoc.embedJpg(replacement.bytes);

    page.drawImage(image, {
      x: block.pdf.x,
      y: block.pdf.y,
      width: block.pdf.width,
      height: block.pdf.height,
      rotate: degrees(block.rotation),
    });
  }

  return pdfDoc.save();
}
