export type ConversionTarget = "pdf" | "jpg" | "png" | "webp" | "docx" | "txt" | "html" | "zip";

export type ConversionOutput = {
  blob: Blob;
  fileName: string;
  mimeType: string;
};

export type ProgressCallback = (progress: number, message?: string) => void;

const mimeByTarget: Record<ConversionTarget, string> = {
  pdf: "application/pdf",
  jpg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  txt: "text/plain;charset=utf-8",
  html: "text/html;charset=utf-8",
  zip: "application/zip",
};

export function getMimeForTarget(target: ConversionTarget) {
  return mimeByTarget[target];
}

export function getExtension(file: File) {
  const nameExtension = file.name.split(".").pop()?.toLowerCase();
  if (nameExtension) return nameExtension;

  if (file.type.includes("pdf")) return "pdf";
  if (file.type.includes("word")) return "docx";
  if (file.type.includes("html")) return "html";
  if (file.type.includes("text")) return "txt";
  if (file.type.includes("jpeg")) return "jpg";
  if (file.type.includes("png")) return "png";
  if (file.type.includes("webp")) return "webp";

  return "";
}

export function isImageFile(file: File) {
  return ["image/jpeg", "image/png", "image/webp", "image/gif"].includes(file.type) || ["jpg", "jpeg", "png", "webp", "gif"].includes(getExtension(file));
}

export function safeBaseName(name: string) {
  const withoutExtension = name.replace(/\.[^/.]+$/, "");
  return withoutExtension.replace(/[^\w.-]+/g, "-").replace(/^-+|-+$/g, "") || "document";
}

export function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export function dataUrlToBlob(dataUrl: string) {
  const [header, body] = dataUrl.split(",");
  const mime = header.match(/data:(.*?);/)?.[1] ?? "application/octet-stream";
  const binary = atob(body);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return new Blob([bytes], { type: mime });
}

export function uint8ArrayToArrayBuffer(bytes: Uint8Array) {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return copy.buffer;
}

export async function fileToDataUrl(file: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("The file could not be read."));
    reader.onload = () => resolve(String(reader.result));
    reader.readAsDataURL(file);
  });
}

export async function fileToText(file: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("The text file could not be read."));
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.readAsText(file);
  });
}

export async function loadImageElement(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("The image could not be loaded."));
    image.src = src;
  });
}

export async function fileToImageCanvas(file: File | Blob, fill = "transparent") {
  const dataUrl = await fileToDataUrl(file);
  const image = await loadImageElement(dataUrl);
  const canvas = document.createElement("canvas");
  canvas.width = image.naturalWidth || image.width;
  canvas.height = image.naturalHeight || image.height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas is not available in this browser.");

  if (fill !== "transparent") {
    context.fillStyle = fill;
    context.fillRect(0, 0, canvas.width, canvas.height);
  }

  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  return canvas;
}

export async function canvasToBlob(canvas: HTMLCanvasElement, mimeType: string, quality = 0.92) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error("The browser could not export this canvas."));
          return;
        }
        resolve(blob);
      },
      mimeType,
      quality,
    );
  });
}

export async function canvasToJpegBlob(canvas: HTMLCanvasElement, quality = 0.92) {
  const exportCanvas = document.createElement("canvas");
  exportCanvas.width = canvas.width;
  exportCanvas.height = canvas.height;
  const context = exportCanvas.getContext("2d");
  if (!context) throw new Error("Canvas is not available in this browser.");

  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, exportCanvas.width, exportCanvas.height);
  context.drawImage(canvas, 0, 0);
  return canvasToBlob(exportCanvas, "image/jpeg", quality);
}

export function makeOutput(blob: Blob, baseName: string, target: ConversionTarget): ConversionOutput {
  return {
    blob,
    fileName: `${safeBaseName(baseName)}.${target}`,
    mimeType: getMimeForTarget(target),
  };
}

export function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
