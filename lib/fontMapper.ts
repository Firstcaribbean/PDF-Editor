import { StandardFonts } from "pdf-lib";

function normalizeFontName(fontName = "") {
  return fontName.replace(/[+,]/g, " ").toLowerCase();
}

function quoteFontFamily(fontFamily: string) {
  if (!fontFamily || /^(serif|sans-serif|monospace|cursive|fantasy|system-ui)$/i.test(fontFamily)) {
    return fontFamily;
  }

  if (fontFamily.includes(",") || /^["'].*["']$/.test(fontFamily)) {
    return fontFamily;
  }

  return `"${fontFamily.replace(/["\\]/g, "")}"`;
}

function fallbackFamilyForFont(fontName?: string, pdfFamily?: string) {
  const normalized = normalizeFontName(`${fontName ?? ""} ${pdfFamily ?? ""}`);

  if (normalized.includes("courier") || normalized.includes("mono")) {
    return '"Courier New", Courier, monospace';
  }

  if (normalized.includes("times") || normalized.includes("serif")) {
    return '"Times New Roman", Times, serif';
  }

  if (normalized.includes("symbol")) {
    return "Symbol, serif";
  }

  return 'Arial, Helvetica, "Liberation Sans", sans-serif';
}

export function mapPdfFontToWeb(fontName?: string, pdfFamily?: string) {
  const fallback = fallbackFamilyForFont(fontName, pdfFamily);
  const family = pdfFamily?.trim();

  if (!family) {
    return fallback;
  }

  const normalized = normalizeFontName(family);
  if (normalized === "sans serif" || normalized === "sans-serif" || normalized === "serif" || normalized === "monospace") {
    return `${family}, ${fallback}`;
  }

  return `${quoteFontFamily(family)}, ${fallback}`;
}

export function inferFontWeight(fontName?: string) {
  const normalized = normalizeFontName(fontName);
  if (normalized.includes("black") || normalized.includes("heavy")) return "800";
  if (normalized.includes("bold") || normalized.includes("semibold")) return "700";
  if (normalized.includes("medium")) return "600";
  return "400";
}

export function inferFontStyle(fontName?: string) {
  const normalized = normalizeFontName(fontName);
  if (normalized.includes("italic") || normalized.includes("oblique")) return "italic";
  return "normal";
}

export function mapToStandardPdfFont(fontName?: string, fontWeight?: string, fontStyle?: string) {
  const normalized = normalizeFontName(fontName);
  const isBold = normalized.includes("bold") || Number(fontWeight) >= 600;
  const isItalic = normalized.includes("italic") || normalized.includes("oblique") || fontStyle === "italic";

  if (normalized.includes("courier") || normalized.includes("mono")) {
    if (isBold && isItalic) return StandardFonts.CourierBoldOblique;
    if (isBold) return StandardFonts.CourierBold;
    if (isItalic) return StandardFonts.CourierOblique;
    return StandardFonts.Courier;
  }

  if (normalized.includes("times") || normalized.includes("serif")) {
    if (isBold && isItalic) return StandardFonts.TimesRomanBoldItalic;
    if (isBold) return StandardFonts.TimesRomanBold;
    if (isItalic) return StandardFonts.TimesRomanItalic;
    return StandardFonts.TimesRoman;
  }

  if (isBold && isItalic) return StandardFonts.HelveticaBoldOblique;
  if (isBold) return StandardFonts.HelveticaBold;
  if (isItalic) return StandardFonts.HelveticaOblique;
  return StandardFonts.Helvetica;
}

export function colorToCss(color: { red: number; green: number; blue: number }) {
  const red = Math.round(color.red * 255);
  const green = Math.round(color.green * 255);
  const blue = Math.round(color.blue * 255);
  return `rgb(${red}, ${green}, ${blue})`;
}
