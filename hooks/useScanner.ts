"use client";

import { useCallback, useRef, useState } from "react";
import imageCompression from "browser-image-compression";
import { PDFDocument } from "pdf-lib";
import { recognizeImageText } from "@/lib/converters/ocrEngine";
import { dataUrlToBlob, downloadBlob, fileToDataUrl, loadImageElement, safeBaseName, uint8ArrayToArrayBuffer } from "@/lib/converters/shared";
import { textToDocxBlob } from "@/lib/converters/txtToPdf";
import { detectDocumentCorners } from "@/lib/scanner/edgeDetection";
import { EnhancementMode, enhanceCanvas } from "@/lib/scanner/imageEnhancement";
import { loadOpenCV } from "@/lib/scanner/opencvLoader";
import { cropByCorners } from "@/lib/scanner/perspectiveWarp";
import { Point } from "@/lib/scanner/cornerOrdering";

export type ScanItem = {
  id: string;
  name: string;
  dataUrl: string;
};

export function useScanner() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [rawDataUrl, setRawDataUrl] = useState<string | null>(null);
  const [processedDataUrl, setProcessedDataUrl] = useState<string | null>(null);
  const [imageName, setImageName] = useState("scan");
  const [imageSize, setImageSize] = useState({ width: 1, height: 1 });
  const [corners, setCorners] = useState<Point[]>([]);
  const [enhancementMode, setEnhancementMode] = useState<EnhancementMode>("auto");
  const [queue, setQueue] = useState<ScanItem[]>([]);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [status, setStatus] = useState("Upload a scan or start the camera.");
  const [error, setError] = useState<string | null>(null);

  const acceptDataUrl = useCallback(async (dataUrl: string, name: string) => {
    const image = await loadImageElement(dataUrl);
    const width = image.naturalWidth || image.width;
    const height = image.naturalHeight || image.height;
    setRawDataUrl(dataUrl);
    setProcessedDataUrl(null);
    setImageName(safeBaseName(name));
    setImageSize({ width, height });
    setCorners(detectDocumentCorners(width, height));
    setStatus("Adjust corners, then clean the scan.");
  }, []);

  const loadImage = useCallback(
    async (file: File) => {
      setError(null);
      setStatus("Preparing image...");
      try {
        const compressed = await imageCompression(file, {
          maxSizeMB: 4,
          maxWidthOrHeight: 2400,
          useWebWorker: true,
        });
        await acceptDataUrl(await fileToDataUrl(compressed), file.name);
      } catch (caught) {
        const message = caught instanceof Error ? caught.message : "The image could not be loaded.";
        setError(message);
        setStatus(message);
      }
    },
    [acceptDataUrl],
  );

  const startCamera = useCallback(async () => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: "environment" },
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setIsCameraActive(true);
      setStatus("Camera ready");
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "Camera permission was denied.";
      setError(message);
      setStatus(message);
    }
  }, []);

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setIsCameraActive(false);
    setStatus("Camera stopped");
  }, []);

  const capturePhoto = useCallback(async () => {
    const video = videoRef.current;
    if (!video) return;

    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;
    const context = canvas.getContext("2d");
    if (!context) return;

    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    await acceptDataUrl(canvas.toDataURL("image/jpeg", 0.94), `scan-${Date.now()}.jpg`);
    setStatus("Photo captured");
  }, [acceptDataUrl]);

  const updateCorner = useCallback((index: number, point: Point) => {
    setCorners((current) => current.map((corner, cornerIndex) => (cornerIndex === index ? point : corner)));
  }, []);

  const processScan = useCallback(async () => {
    if (!rawDataUrl) return;

    setIsProcessing(true);
    setError(null);
    setStatus("Cleaning scan...");

    try {
      await loadOpenCV();
      const image = await loadImageElement(rawDataUrl);
      const cropped = await cropByCorners(image, corners);
      const enhanced = enhanceCanvas(cropped, enhancementMode);
      setProcessedDataUrl(enhanced.toDataURL("image/jpeg", 0.94));
      setStatus("Cleaned scan ready");
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "The scan could not be processed.";
      setError(message);
      setStatus(message);
    } finally {
      setIsProcessing(false);
    }
  }, [corners, enhancementMode, rawDataUrl]);

  const addToQueue = useCallback(() => {
    const dataUrl = processedDataUrl ?? rawDataUrl;
    if (!dataUrl) return;

    setQueue((current) => [
      ...current,
      {
        id: crypto.randomUUID(),
        name: `${imageName || "scan"}-${current.length + 1}`,
        dataUrl,
      },
    ]);
    setStatus("Page added");
  }, [imageName, processedDataUrl, rawDataUrl]);

  const removeFromQueue = useCallback((id: string) => {
    setQueue((current) => current.filter((item) => item.id !== id));
  }, []);

  const exportPDF = useCallback(async () => {
    const scans = queue.length ? queue : processedDataUrl || rawDataUrl ? [{ id: "current", name: imageName, dataUrl: processedDataUrl ?? rawDataUrl! }] : [];
    if (!scans.length) return;

    setStatus("Exporting PDF...");
    const pdfDoc = await PDFDocument.create();

    for (const scan of scans) {
      const blob = dataUrlToBlob(scan.dataUrl);
      const bytes = await blob.arrayBuffer();
      const image = blob.type === "image/png" ? await pdfDoc.embedPng(bytes) : await pdfDoc.embedJpg(bytes);
      const page = pdfDoc.addPage([image.width, image.height]);
      page.drawImage(image, { x: 0, y: 0, width: image.width, height: image.height });
    }

    downloadBlob(new Blob([uint8ArrayToArrayBuffer(await pdfDoc.save())], { type: "application/pdf" }), `${safeBaseName(imageName)}.pdf`);
    setStatus("PDF exported");
  }, [imageName, processedDataUrl, queue, rawDataUrl]);

  const exportText = useCallback(
    async (format: "txt" | "docx") => {
      const scans = queue.length ? queue : processedDataUrl || rawDataUrl ? [{ id: "current", name: imageName, dataUrl: processedDataUrl ?? rawDataUrl! }] : [];
      if (!scans.length) return;

      setStatus("Recognizing text...");
      const textParts: string[] = [];
      for (const scan of scans) {
        textParts.push(await recognizeImageText(scan.dataUrl));
      }

      const text = textParts.join("\n\n");
      if (format === "docx") {
        downloadBlob(await textToDocxBlob(text), `${safeBaseName(imageName)}.docx`);
      } else {
        downloadBlob(new Blob([text], { type: "text/plain;charset=utf-8" }), `${safeBaseName(imageName)}.txt`);
      }
      setStatus(`${format.toUpperCase()} exported`);
    },
    [imageName, processedDataUrl, queue, rawDataUrl],
  );

  return {
    videoRef,
    rawDataUrl,
    processedDataUrl,
    imageName,
    imageSize,
    corners,
    enhancementMode,
    queue,
    isCameraActive,
    isProcessing,
    status,
    error,
    setEnhancementMode,
    loadImage,
    startCamera,
    stopCamera,
    capturePhoto,
    updateCorner,
    processScan,
    addToQueue,
    removeFromQueue,
    exportPDF,
    exportText,
  };
}
