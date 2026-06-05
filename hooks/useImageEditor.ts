"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Document, ImageRun, Packer, Paragraph } from "docx";
import { PDFDocument } from "pdf-lib";
import { dataUrlToBlob, downloadBlob, fileToDataUrl, loadImageElement, safeBaseName, uint8ArrayToArrayBuffer } from "@/lib/converters/shared";

export type ImageEditorTool = "move" | "text" | "draw" | "rect" | "circle" | "line";
export type ImageExportFormat = "png" | "jpg" | "webp" | "pdf" | "docx";

type FabricModule = typeof import("fabric");

export function useImageEditor() {
  const canvasElementRef = useRef<HTMLCanvasElement | null>(null);
  const fabricRef = useRef<FabricModule | null>(null);
  const canvasRef = useRef<any>(null);
  const [isReady, setIsReady] = useState(false);
  const [imageName, setImageName] = useState<string | null>(null);
  const [tool, setTool] = useState<ImageEditorTool>("move");
  const [color, setColor] = useState("#111111");
  const [strokeWidth, setStrokeWidth] = useState(4);
  const [opacity, setOpacity] = useState(1);
  const [status, setStatus] = useState("Upload an image to begin.");
  const [error, setError] = useState<string | null>(null);
  const [hasImage, setHasImage] = useState(false);

  const setCanvasBackground = useCallback(async (dataUrl: string, nextName?: string) => {
    const Fabric = fabricRef.current;
    const canvas = canvasRef.current;
    if (!Fabric || !canvas) throw new Error("The editor canvas is still loading.");

    const sourceImage = await loadImageElement(dataUrl);
    const image = await Fabric.FabricImage.fromURL(dataUrl);
    const rawWidth = sourceImage.naturalWidth || image.width || 900;
    const rawHeight = sourceImage.naturalHeight || image.height || 650;
    const maxWidth = 1120;
    const scale = Math.min(1, maxWidth / rawWidth);
    const width = Math.max(1, Math.round(rawWidth * scale));
    const height = Math.max(1, Math.round(rawHeight * scale));

    canvas.clear();
    canvas.backgroundColor = "#ffffff";
    canvas.setDimensions({ width, height });
    image.set({
      left: 0,
      top: 0,
      scaleX: width / rawWidth,
      scaleY: height / rawHeight,
      selectable: false,
      evented: false,
      hasControls: false,
      hasBorders: false,
      lockMovementX: true,
      lockMovementY: true,
      lockRotation: true,
      lockScalingX: true,
      lockScalingY: true,
      hoverCursor: "default",
    });
    canvas.add(image);
    canvas.sendObjectToBack(image);
    canvas.discardActiveObject();
    canvas.requestRenderAll();

    setHasImage(true);
    if (nextName) setImageName(nextName);
    setStatus("Image ready");
  }, []);

  useEffect(() => {
    if (!canvasElementRef.current) return;
    let disposed = false;

    async function setupCanvas() {
      const Fabric = await import("fabric");
      if (disposed || !canvasElementRef.current) return;

      const canvas = new Fabric.Canvas(canvasElementRef.current, {
        width: 900,
        height: 560,
        backgroundColor: "#ffffff",
        preserveObjectStacking: true,
        selection: true,
      });

      const brush = new Fabric.PencilBrush(canvas);
      brush.width = 4;
      brush.color = "#111111";
      canvas.freeDrawingBrush = brush;

      fabricRef.current = Fabric;
      canvasRef.current = canvas;
      setIsReady(true);
    }

    void setupCanvas();

    return () => {
      disposed = true;
      canvasRef.current?.dispose();
      canvasRef.current = null;
    };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    const Fabric = fabricRef.current;
    if (!canvas || !Fabric) return;

    canvas.isDrawingMode = tool === "draw";
    canvas.defaultCursor = tool === "draw" ? "crosshair" : "default";
    canvas.selection = tool !== "draw";

    if (tool === "draw") {
      const brush = canvas.freeDrawingBrush ?? new Fabric.PencilBrush(canvas);
      brush.color = color;
      brush.width = strokeWidth;
      canvas.freeDrawingBrush = brush;
    }
  }, [tool, color, strokeWidth, isReady]);

  const loadImage = useCallback(
    async (file: File) => {
      setError(null);
      setStatus("Loading image...");
      try {
        await setCanvasBackground(await fileToDataUrl(file), file.name);
      } catch (caught) {
        const message = caught instanceof Error ? caught.message : "The image could not be opened.";
        setError(message);
        setStatus(message);
      }
    },
    [setCanvasBackground],
  );

  const addText = useCallback(() => {
    const Fabric = fabricRef.current;
    const canvas = canvasRef.current;
    if (!Fabric || !canvas) return;

    const text = new Fabric.IText("Click to edit", {
      left: 72,
      top: 72,
      fontFamily: "Arial",
      fontSize: 34,
      fill: color,
      opacity,
    });

    canvas.add(text);
    canvas.setActiveObject(text);
    canvas.renderAll();
    setTool("move");
    setStatus("Text added");
  }, [color, opacity]);

  const addShape = useCallback(
    (shape: Exclude<ImageEditorTool, "move" | "text" | "draw">) => {
      const Fabric = fabricRef.current;
      const canvas = canvasRef.current;
      if (!Fabric || !canvas) return;

      const options = {
        left: 96,
        top: 96,
        stroke: color,
        strokeWidth,
        opacity,
        fill: "rgba(255,255,255,0)",
      };

      const object =
        shape === "rect"
          ? new Fabric.Rect({ ...options, width: 180, height: 110 })
          : shape === "circle"
            ? new Fabric.Circle({ ...options, radius: 68 })
            : new Fabric.Line([90, 150, 280, 150], {
                stroke: color,
                strokeWidth,
                opacity,
              });

      canvas.add(object);
      canvas.setActiveObject(object);
      canvas.renderAll();
      setTool("move");
      setStatus(`${shape === "rect" ? "Rectangle" : shape === "circle" ? "Circle" : "Line"} added`);
    },
    [color, opacity, strokeWidth],
  );

  const deleteSelection = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const selection = canvas.getActiveObjects();
    selection.forEach((object: unknown) => canvas.remove(object));
    canvas.discardActiveObject();
    canvas.renderAll();
    setStatus(selection.length ? "Selection deleted" : "Nothing selected");
  }, []);

  const applyColorToSelection = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const activeObjects = canvas.getActiveObjects();
    activeObjects.forEach((object: any) => {
      if ("set" in object) {
        object.set("fill", object.type === "line" ? object.fill : color);
        object.set("stroke", color);
        object.set("opacity", opacity);
      }
    });
    canvas.renderAll();
    setStatus(activeObjects.length ? "Selection updated" : "Choose an object first");
  }, [color, opacity]);

  const cropToSelection = useCallback(async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const object = canvas.getActiveObject();
    if (!object) {
      setStatus("Select an area or object to crop.");
      return;
    }

    const bounds = object.getBoundingRect();
    const dataUrl = canvas.toDataURL({
      format: "png",
      left: Math.max(0, bounds.left),
      top: Math.max(0, bounds.top),
      width: Math.max(1, bounds.width),
      height: Math.max(1, bounds.height),
    });

    await setCanvasBackground(dataUrl, imageName ?? "cropped-image.png");
    setStatus("Canvas cropped");
  }, [imageName, setCanvasBackground]);

  const exportFile = useCallback(
    async (format: ImageExportFormat) => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const baseName = safeBaseName(imageName ?? "edited-image");
      const imageFormat = format === "jpg" ? "jpeg" : format;
      const dataUrl = canvas.toDataURL({
        format: format === "pdf" || format === "docx" ? "png" : imageFormat,
        quality: 0.92,
        multiplier: 1,
      });

      if (format === "pdf") {
        const pdfDoc = await PDFDocument.create();
        const jpegDataUrl = canvas.toDataURL({ format: "jpeg", quality: 0.92, multiplier: 1 });
        const blob = dataUrlToBlob(jpegDataUrl);
        const image = await pdfDoc.embedJpg(await blob.arrayBuffer());
        const page = pdfDoc.addPage([image.width, image.height]);
        page.drawImage(image, { x: 0, y: 0, width: image.width, height: image.height });
        downloadBlob(new Blob([uint8ArrayToArrayBuffer(await pdfDoc.save())], { type: "application/pdf" }), `${baseName}.pdf`);
        setStatus("PDF exported");
        return;
      }

      if (format === "docx") {
        const pngBlob = dataUrlToBlob(dataUrl);
        const width = Math.min(620, canvas.width);
        const height = Math.round((canvas.height / canvas.width) * width);
        const document = new Document({
          sections: [
            {
              children: [
                new Paragraph({
                  children: [
                    new ImageRun({
                      type: "png",
                      data: await pngBlob.arrayBuffer(),
                      transformation: { width, height },
                    }),
                  ],
                }),
              ],
            },
          ],
        });
        downloadBlob(await Packer.toBlob(document), `${baseName}.docx`);
        setStatus("DOCX exported");
        return;
      }

      const extension = format === "jpg" ? "jpg" : format;
      const mimeType = format === "jpg" ? "image/jpeg" : `image/${format}`;
      downloadBlob(dataUrlToBlob(dataUrl), `${baseName}.${extension}`);
      setStatus(`${extension.toUpperCase()} exported`);
    },
    [imageName],
  );

  return {
    canvasElementRef,
    isReady,
    hasImage,
    imageName,
    tool,
    color,
    strokeWidth,
    opacity,
    status,
    error,
    setTool,
    setColor,
    setStrokeWidth,
    setOpacity,
    loadImage,
    addText,
    addShape,
    deleteSelection,
    applyColorToSelection,
    cropToSelection,
    exportFile,
  };
}
