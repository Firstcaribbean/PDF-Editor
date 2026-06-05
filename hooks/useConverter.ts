"use client";

import { useMemo, useState } from "react";
import { docxToHtml, docxToText } from "@/lib/converters/docxToHtml";
import { docxToPdf } from "@/lib/converters/docxToPdf";
import { imagesToDocx } from "@/lib/converters/imgToDocx";
import { imagesToPdf } from "@/lib/converters/imgToPdf";
import { recognizeImageText } from "@/lib/converters/ocrEngine";
import { pdfToDocx } from "@/lib/converters/pdfToDocx";
import { pdfImagesToZip, pdfToImages } from "@/lib/converters/pdfToImg";
import { pdfToHtml, pdfToText } from "@/lib/converters/pdfToTxt";
import {
  canvasToBlob,
  ConversionOutput,
  ConversionTarget,
  downloadBlob,
  fileToImageCanvas,
  fileToText,
  getExtension,
  isImageFile,
  makeOutput,
  ProgressCallback,
  safeBaseName,
} from "@/lib/converters/shared";
import { htmlToPdfBlob, textToDocxBlob, textToPdfBlob } from "@/lib/converters/txtToPdf";
import { packFilesAsZip } from "@/lib/converters/zipPacker";

const imageTargets: ConversionTarget[] = ["pdf", "png", "jpg", "webp", "docx", "txt"];

const conversionMap: Record<string, ConversionTarget[]> = {
  pdf: ["jpg", "png", "webp", "docx", "txt", "html", "zip"],
  jpg: imageTargets,
  jpeg: imageTargets,
  png: imageTargets,
  webp: imageTargets,
  gif: imageTargets,
  docx: ["pdf", "txt", "html"],
  txt: ["pdf", "docx"],
  html: ["pdf", "txt"],
};

function sourceTypeFor(files: File[]) {
  if (!files.length) return "";
  if (files.length > 1 && files.every(isImageFile)) return "images";
  return getExtension(files[0]);
}

function stripHtml(html: string) {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li|h[1-6])>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .trim();
}

async function convertImageFile(file: File, target: ConversionTarget, onProgress: ProgressCallback): Promise<ConversionOutput> {
  const baseName = safeBaseName(file.name);

  if (target === "pdf") {
    return makeOutput(await imagesToPdf([file], onProgress), baseName, "pdf");
  }

  if (target === "docx") {
    return makeOutput(await imagesToDocx([file], onProgress), baseName, "docx");
  }

  if (target === "txt") {
    const text = await recognizeImageText(file, onProgress);
    return makeOutput(new Blob([text || ""], { type: "text/plain;charset=utf-8" }), baseName, "txt");
  }

  if (target === "png" || target === "jpg" || target === "webp") {
    onProgress(35, "Re-rendering image");
    const canvas = await fileToImageCanvas(file, target === "jpg" ? "#ffffff" : "transparent");
    const mimeType = target === "jpg" ? "image/jpeg" : `image/${target}`;
    const blob = await canvasToBlob(canvas, mimeType, 0.92);
    return makeOutput(blob, baseName, target);
  }

  throw new Error("This image conversion is not supported.");
}

export function useConverter() {
  const [files, setFiles] = useState<File[]>([]);
  const [target, setTarget] = useState<ConversionTarget | null>(null);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState<"idle" | "working" | "done" | "error">("idle");
  const [statusText, setStatusText] = useState("Waiting for a file");
  const [output, setOutput] = useState<ConversionOutput | null>(null);
  const [error, setError] = useState<string | null>(null);

  const sourceType = useMemo(() => sourceTypeFor(files), [files]);
  const targets = useMemo<ConversionTarget[]>(() => {
    if (sourceType === "images") return ["pdf", "zip"];
    return conversionMap[sourceType] ?? [];
  }, [sourceType]);

  const updateFiles = (nextFiles: File[]) => {
    setFiles(nextFiles);
    setOutput(null);
    setError(null);
    setStatus("idle");
    setProgress(0);
    setStatusText(nextFiles.length ? "Choose an output format" : "Waiting for a file");
    const nextSourceType = sourceTypeFor(nextFiles);
    const nextTargets: ConversionTarget[] = nextSourceType === "images" ? ["pdf", "zip"] : (conversionMap[nextSourceType] ?? []);
    setTarget(nextTargets[0] ?? null);
  };

  const convert = async () => {
    if (!files.length || !target) return;

    setStatus("working");
    setError(null);
    setOutput(null);
    setProgress(0);

    const report: ProgressCallback = (nextProgress, message) => {
      setProgress(Math.min(99, Math.max(0, nextProgress)));
      if (message) setStatusText(message);
    };

    try {
      const firstFile = files[0];
      const baseName = safeBaseName(firstFile.name);
      let result: ConversionOutput;

      if (sourceType === "images") {
        if (target === "zip") {
          result = await packFilesAsZip(files, `${baseName}-images.zip`);
        } else {
          result = makeOutput(await imagesToPdf(files, report), `${baseName}-bundle`, "pdf");
        }
      } else if (sourceType === "pdf") {
        if (target === "txt") {
          result = makeOutput(new Blob([await pdfToText(firstFile, report)], { type: "text/plain;charset=utf-8" }), baseName, "txt");
        } else if (target === "html") {
          result = makeOutput(new Blob([await pdfToHtml(firstFile, report)], { type: "text/html;charset=utf-8" }), baseName, "html");
        } else if (target === "docx") {
          result = makeOutput(await pdfToDocx(firstFile, report), baseName, "docx");
        } else if (target === "zip") {
          result = makeOutput(await pdfImagesToZip(firstFile, "png", report), `${baseName}-pages`, "zip");
        } else if (target === "png" || target === "jpg" || target === "webp") {
          const pages = await pdfToImages(firstFile, target, report);
          if (pages.length === 1) {
            result = makeOutput(pages[0].blob, `${baseName}-page-1`, target);
          } else {
            result = makeOutput(await pdfImagesToZip(firstFile, target, report), `${baseName}-pages`, "zip");
          }
        } else {
          throw new Error("This PDF conversion is not supported.");
        }
      } else if (isImageFile(firstFile)) {
        result = await convertImageFile(firstFile, target, report);
      } else if (sourceType === "docx") {
        if (target === "html") {
          result = makeOutput(new Blob([await docxToHtml(firstFile)], { type: "text/html;charset=utf-8" }), baseName, "html");
        } else if (target === "txt") {
          result = makeOutput(new Blob([await docxToText(firstFile)], { type: "text/plain;charset=utf-8" }), baseName, "txt");
        } else if (target === "pdf") {
          result = makeOutput(await docxToPdf(firstFile), baseName, "pdf");
        } else {
          throw new Error("This DOCX conversion is not supported.");
        }
      } else if (sourceType === "txt") {
        const text = await fileToText(firstFile);
        result = target === "docx" ? makeOutput(await textToDocxBlob(text), baseName, "docx") : makeOutput(await textToPdfBlob(text, firstFile.name), baseName, "pdf");
      } else if (sourceType === "html") {
        const html = await fileToText(firstFile);
        result =
          target === "txt"
            ? makeOutput(new Blob([stripHtml(html)], { type: "text/plain;charset=utf-8" }), baseName, "txt")
            : makeOutput(await htmlToPdfBlob(html, firstFile.name), baseName, "pdf");
      } else {
        throw new Error("This file type is not supported yet.");
      }

      setProgress(100);
      setStatus("done");
      setStatusText("Conversion ready");
      setOutput(result);
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "The conversion failed.";
      setError(message);
      setStatus("error");
      setStatusText(message);
    }
  };

  const download = () => {
    if (output) downloadBlob(output.blob, output.fileName);
  };

  return {
    files,
    sourceType,
    targets,
    target,
    progress,
    status,
    statusText,
    output,
    error,
    setFiles: updateFiles,
    setTarget,
    convert,
    download,
  };
}
