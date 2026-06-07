export type RGBColor = {
  red: number;
  green: number;
  blue: number;
};

export type TextBlockGeometry = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type EditorFontResource = {
  id: string;
  cssFamily?: string;
  originalName?: string;
  fallbackName?: string;
  bytes?: Uint8Array;
};

export type EditorTextBlock = {
  id: string;
  pageIndex: number;
  pageNumber: number;
  text: string;
  originalText: string;
  screen: {
    left: number;
    top: number;
    width: number;
    height: number;
  };
  pdf: TextBlockGeometry;
  fontName: string;
  originalFontName: string;
  fontFamily: string;
  originalFontFamily: string;
  fontSize: number;
  pdfFontSize: number;
  ascent: number;
  descent: number;
  horizontalScale: number;
  fontWeight: string;
  originalFontWeight: string;
  fontStyle: string;
  originalFontStyle: string;
  underline: boolean;
  originalUnderline: boolean;
  strikeThrough: boolean;
  originalStrikeThrough: boolean;
  color: RGBColor;
  backgroundColor: RGBColor;
  rotation: number;
  dirty: boolean;
};

export type EditorFontOption = {
  fontName: string;
  fontFamily: string;
  label: string;
  source: "detected" | "standard";
};

export type ImageReplacement = {
  bytes: Uint8Array;
  dataUrl: string;
  mimeType: "image/jpeg" | "image/png";
};

export type EditorImageBlock = {
  id: string;
  pageIndex: number;
  pageNumber: number;
  screen: {
    left: number;
    top: number;
    width: number;
    height: number;
  };
  pdf: TextBlockGeometry;
  rotation: number;
  dirty: boolean;
  replacement?: ImageReplacement;
};

export type EditorPageModel = {
  pageIndex: number;
  pageNumber: number;
  width: number;
  height: number;
  rotation: number;
  textBlocks: EditorTextBlock[];
  imageBlocks: EditorImageBlock[];
};

export type EditorDocumentModel = {
  fileName: string;
  originalBytes: Uint8Array;
  fingerprint?: string;
  pageCount: number;
  fonts: Record<string, EditorFontResource>;
  pages: EditorPageModel[];
};

export type EditorPageOverlay = {
  pageIndex: number;
  textBlocks: EditorTextBlock[];
  imageBlocks: EditorImageBlock[];
};

export type EditorDocumentOverlay = {
  pages: EditorPageOverlay[];
};

export type StoredPDFDocument = {
  id: string;
  fileName: string;
  bytes: ArrayBuffer;
  createdAt: number;
  downloadable?: boolean;
  overlay?: EditorDocumentOverlay;
  size: number;
};
