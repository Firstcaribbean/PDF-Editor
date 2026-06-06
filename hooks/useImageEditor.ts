"use client";

import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { Document, ImageRun, Packer, Paragraph } from "docx";
import { PDFDocument } from "pdf-lib";
import { enhanceCanvas, type EnhancementMode } from "@/lib/scanner/imageEnhancement";
import { dataUrlToBlob, downloadBlob, fileToDataUrl, loadImageElement, safeBaseName, uint8ArrayToArrayBuffer } from "@/lib/converters/shared";

export type ImageEditorTool = "move" | "text" | "draw" | "rect" | "circle" | "line";
export type ImageExportFormat = "png" | "jpg" | "webp" | "pdf" | "docx";
export type TextFontWeight = "normal" | "bold";
export type TextFontStyle = "normal" | "italic";

type Point = {
  x: number;
  y: number;
};

type BaseObject = {
  id: string;
  opacity: number;
};

type TextObject = BaseObject & {
  type: "text";
  x: number;
  y: number;
  text: string;
  fontFamily: string;
  fontSize: number;
  fontWeight: TextFontWeight;
  fontStyle: TextFontStyle;
  underline: boolean;
  strikethrough: boolean;
  fill: string;
};

type PathObject = BaseObject & {
  type: "path";
  points: Point[];
  stroke: string;
  strokeWidth: number;
};

type RectObject = BaseObject & {
  type: "rect";
  x: number;
  y: number;
  width: number;
  height: number;
  stroke: string;
  strokeWidth: number;
};

type CircleObject = BaseObject & {
  type: "circle";
  x: number;
  y: number;
  width: number;
  height: number;
  stroke: string;
  strokeWidth: number;
};

type LineObject = BaseObject & {
  type: "line";
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  stroke: string;
  strokeWidth: number;
};

type EditorObject = TextObject | PathObject | RectObject | CircleObject | LineObject;

type Interaction =
  | { kind: "move"; objectId: string; origin: Point }
  | { kind: "draw"; object: PathObject }
  | { kind: "shape"; object: RectObject | CircleObject | LineObject };

export const imageEditorFontOptions = [
  "Arial",
  "Helvetica",
  "Times New Roman",
  "Georgia",
  "Courier New",
  "Verdana",
  "Impact",
  "Trebuchet MS",
];

const defaultCanvasSize = {
  width: 900,
  height: 560,
};

function makeId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function quoteFontFamily(fontFamily: string) {
  return fontFamily.includes(" ") ? `"${fontFamily}"` : fontFamily;
}

function getTextFont(object: TextObject) {
  return `${object.fontStyle} ${object.fontWeight} ${object.fontSize}px ${quoteFontFamily(object.fontFamily)}`;
}

function normalizeBounds(bounds: { x: number; y: number; width: number; height: number }) {
  const x = bounds.width < 0 ? bounds.x + bounds.width : bounds.x;
  const y = bounds.height < 0 ? bounds.y + bounds.height : bounds.y;

  return {
    x,
    y,
    width: Math.abs(bounds.width),
    height: Math.abs(bounds.height),
  };
}

function clampBounds(bounds: { x: number; y: number; width: number; height: number }, width: number, height: number) {
  const normalized = normalizeBounds(bounds);
  const x = Math.max(0, Math.min(width, normalized.x));
  const y = Math.max(0, Math.min(height, normalized.y));
  const right = Math.max(x + 1, Math.min(width, normalized.x + normalized.width));
  const bottom = Math.max(y + 1, Math.min(height, normalized.y + normalized.height));

  return {
    x,
    y,
    width: Math.max(1, right - x),
    height: Math.max(1, bottom - y),
  };
}

function measureTextObject(context: CanvasRenderingContext2D, object: TextObject) {
  context.save();
  context.font = getTextFont(object);
  const lines = object.text.split("\n");
  const width = Math.max(1, ...lines.map((line) => context.measureText(line || " ").width));
  const lineHeight = object.fontSize * 1.2;
  context.restore();

  return {
    x: object.x,
    y: object.y,
    width,
    height: Math.max(lineHeight, lines.length * lineHeight),
  };
}

function getObjectBounds(context: CanvasRenderingContext2D, object: EditorObject) {
  if (object.type === "text") return measureTextObject(context, object);

  if (object.type === "rect" || object.type === "circle") {
    return normalizeBounds({
      x: object.x,
      y: object.y,
      width: object.width,
      height: object.height,
    });
  }

  if (object.type === "line") {
    return normalizeBounds({
      x: object.x1,
      y: object.y1,
      width: object.x2 - object.x1,
      height: object.y2 - object.y1,
    });
  }

  const xs = object.points.map((point) => point.x);
  const ys = object.points.map((point) => point.y);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  const maxX = Math.max(...xs);
  const maxY = Math.max(...ys);

  return {
    x: minX,
    y: minY,
    width: Math.max(1, maxX - minX),
    height: Math.max(1, maxY - minY),
  };
}

function distanceToSegment(point: Point, start: Point, end: Point) {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const lengthSquared = dx * dx + dy * dy;

  if (!lengthSquared) return Math.hypot(point.x - start.x, point.y - start.y);

  const t = Math.max(0, Math.min(1, ((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSquared));
  const projectedX = start.x + t * dx;
  const projectedY = start.y + t * dy;
  return Math.hypot(point.x - projectedX, point.y - projectedY);
}

function moveObject(object: EditorObject, dx: number, dy: number): EditorObject {
  if (object.type === "text") return { ...object, x: object.x + dx, y: object.y + dy };
  if (object.type === "rect" || object.type === "circle") return { ...object, x: object.x + dx, y: object.y + dy };
  if (object.type === "line") return { ...object, x1: object.x1 + dx, y1: object.y1 + dy, x2: object.x2 + dx, y2: object.y2 + dy };
  return { ...object, points: object.points.map((point) => ({ x: point.x + dx, y: point.y + dy })) };
}

function drawTextDecoration(context: CanvasRenderingContext2D, object: TextObject, y: number, width: number, kind: "underline" | "strike") {
  const offset = kind === "underline" ? object.fontSize * 0.95 : object.fontSize * 0.55;
  context.beginPath();
  context.moveTo(object.x, y + offset);
  context.lineTo(object.x + width, y + offset);
  context.stroke();
}

function renderObject(context: CanvasRenderingContext2D, object: EditorObject, selected = false) {
  context.save();
  context.globalAlpha = object.opacity;
  context.lineCap = "round";
  context.lineJoin = "round";

  if (object.type === "text") {
    context.font = getTextFont(object);
    context.fillStyle = object.fill;
    context.strokeStyle = object.fill;
    context.lineWidth = Math.max(1, object.fontSize / 14);
    context.textBaseline = "top";

    const lineHeight = object.fontSize * 1.2;
    object.text.split("\n").forEach((line, index) => {
      const y = object.y + index * lineHeight;
      context.fillText(line || " ", object.x, y);
      const width = context.measureText(line || " ").width;
      if (object.underline) drawTextDecoration(context, object, y, width, "underline");
      if (object.strikethrough) drawTextDecoration(context, object, y, width, "strike");
    });
  }

  if (object.type === "path") {
    context.strokeStyle = object.stroke;
    context.lineWidth = object.strokeWidth;
    context.beginPath();
    object.points.forEach((point, index) => {
      if (index === 0) context.moveTo(point.x, point.y);
      else context.lineTo(point.x, point.y);
    });
    context.stroke();
  }

  if (object.type === "rect") {
    const bounds = normalizeBounds(object);
    context.strokeStyle = object.stroke;
    context.lineWidth = object.strokeWidth;
    context.strokeRect(bounds.x, bounds.y, bounds.width, bounds.height);
  }

  if (object.type === "circle") {
    const bounds = normalizeBounds(object);
    context.strokeStyle = object.stroke;
    context.lineWidth = object.strokeWidth;
    context.beginPath();
    context.ellipse(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2, Math.max(1, bounds.width / 2), Math.max(1, bounds.height / 2), 0, 0, Math.PI * 2);
    context.stroke();
  }

  if (object.type === "line") {
    context.strokeStyle = object.stroke;
    context.lineWidth = object.strokeWidth;
    context.beginPath();
    context.moveTo(object.x1, object.y1);
    context.lineTo(object.x2, object.y2);
    context.stroke();
  }

  context.restore();

  if (selected) {
    const bounds = getObjectBounds(context, object);
    context.save();
    context.strokeStyle = "#15b979";
    context.lineWidth = 1.5;
    context.setLineDash([6, 4]);
    context.strokeRect(bounds.x - 4, bounds.y - 4, bounds.width + 8, bounds.height + 8);
    context.restore();
  }
}

function pointInsideBounds(point: Point, bounds: { x: number; y: number; width: number; height: number }, padding = 6) {
  return point.x >= bounds.x - padding && point.x <= bounds.x + bounds.width + padding && point.y >= bounds.y - padding && point.y <= bounds.y + bounds.height + padding;
}

function objectContainsPoint(context: CanvasRenderingContext2D, object: EditorObject, point: Point) {
  if (object.type === "line") {
    return distanceToSegment(point, { x: object.x1, y: object.y1 }, { x: object.x2, y: object.y2 }) <= Math.max(8, object.strokeWidth + 4);
  }

  if (object.type === "path") {
    return object.points.some((start, index) => {
      const end = object.points[index + 1];
      return end ? distanceToSegment(point, start, end) <= Math.max(8, object.strokeWidth + 4) : false;
    });
  }

  return pointInsideBounds(point, getObjectBounds(context, object));
}

export function useImageEditor() {
  const canvasElementRef = useRef<HTMLCanvasElement | null>(null);
  const baseImageRef = useRef<HTMLImageElement | null>(null);
  const objectsRef = useRef<EditorObject[]>([]);
  const selectedObjectIdRef = useRef<string | null>(null);
  const previewObjectRef = useRef<EditorObject | null>(null);
  const interactionRef = useRef<Interaction | null>(null);
  const hasImageRef = useRef(false);

  const [objects, setObjects] = useState<EditorObject[]>([]);
  const [selectedObjectId, setSelectedObjectId] = useState<string | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [imageName, setImageName] = useState<string | null>(null);
  const [tool, setTool] = useState<ImageEditorTool>("move");
  const [color, setColor] = useState("#111111");
  const [strokeWidth, setStrokeWidth] = useState(4);
  const [opacity, setOpacity] = useState(1);
  const [fontFamily, setFontFamily] = useState("Arial");
  const [fontSize, setFontSize] = useState(34);
  const [isBold, setIsBold] = useState(false);
  const [isItalic, setIsItalic] = useState(false);
  const [isUnderline, setIsUnderline] = useState(false);
  const [isStrikethrough, setIsStrikethrough] = useState(false);
  const [enhancementMode, setEnhancementMode] = useState<EnhancementMode>("auto");
  const [isProcessing, setIsProcessing] = useState(false);
  const [status, setStatus] = useState("Upload an image to begin.");
  const [error, setError] = useState<string | null>(null);
  const [hasImage, setHasImageState] = useState(false);

  const setHasImage = useCallback((nextHasImage: boolean) => {
    hasImageRef.current = nextHasImage;
    setHasImageState(nextHasImage);
  }, []);

  const getContext = useCallback(() => {
    const canvas = canvasElementRef.current;
    const context = canvas?.getContext("2d");
    return canvas && context ? { canvas, context } : null;
  }, []);

  const renderCanvas = useCallback(() => {
    const current = getContext();
    if (!current) return;

    const { canvas, context } = current;
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, canvas.width, canvas.height);

    if (baseImageRef.current) {
      context.drawImage(baseImageRef.current, 0, 0, canvas.width, canvas.height);
    }

    const selected = selectedObjectIdRef.current;
    objectsRef.current.forEach((object) => renderObject(context, object, object.id === selected));

    if (previewObjectRef.current) {
      renderObject(context, previewObjectRef.current, true);
    }
  }, [getContext]);

  const commitObjects = useCallback(
    (nextObjects: EditorObject[]) => {
      objectsRef.current = nextObjects;
      setObjects(nextObjects);
      window.requestAnimationFrame(renderCanvas);
    },
    [renderCanvas],
  );

  const selectObject = useCallback(
    (objectId: string | null) => {
      selectedObjectIdRef.current = objectId;
      setSelectedObjectId(objectId);

      const current = getContext();
      const object = objectId ? objectsRef.current.find((candidate) => candidate.id === objectId) : null;

      if (object) {
        setOpacity(object.opacity);

        if (object.type === "text") {
          setColor(object.fill);
          setFontFamily(object.fontFamily);
          setFontSize(object.fontSize);
          setIsBold(object.fontWeight === "bold");
          setIsItalic(object.fontStyle === "italic");
          setIsUnderline(object.underline);
          setIsStrikethrough(object.strikethrough);
        } else if ("stroke" in object) {
          setColor(object.stroke);
          setStrokeWidth(object.strokeWidth);
        }
      }

      if (current) window.requestAnimationFrame(renderCanvas);
    },
    [getContext, renderCanvas],
  );

  const setCanvasBase = useCallback(
    async (dataUrl: string, nextName?: string, clearObjects = true) => {
      const current = getContext();
      if (!current) throw new Error("The editor canvas is still loading.");

      const image = await loadImageElement(dataUrl);
      const rawWidth = image.naturalWidth || image.width || defaultCanvasSize.width;
      const rawHeight = image.naturalHeight || image.height || defaultCanvasSize.height;
      const maxWidth = 1120;
      const maxHeight = 1600;
      const scale = Math.min(1, maxWidth / rawWidth, maxHeight / rawHeight);
      const width = Math.max(1, Math.round(rawWidth * scale));
      const height = Math.max(1, Math.round(rawHeight * scale));

      current.canvas.width = width;
      current.canvas.height = height;
      baseImageRef.current = image;
      previewObjectRef.current = null;
      interactionRef.current = null;

      if (clearObjects) {
        objectsRef.current = [];
        setObjects([]);
        selectObject(null);
      }

      setHasImage(true);
      if (nextName) setImageName(nextName);
      renderCanvas();
    },
    [getContext, renderCanvas, selectObject, setHasImage],
  );

  useEffect(() => {
    const canvas = canvasElementRef.current;
    if (!canvas) return;

    canvas.width = defaultCanvasSize.width;
    canvas.height = defaultCanvasSize.height;
    setIsReady(true);
    renderCanvas();
  }, [renderCanvas]);

  useEffect(() => {
    objectsRef.current = objects;
    renderCanvas();
  }, [objects, selectedObjectId, renderCanvas]);

  const loadImage = useCallback(
    async (file: File) => {
      setError(null);
      setStatus("Loading image...");
      try {
        await setCanvasBase(await fileToDataUrl(file), file.name);
        setStatus("Image ready");
      } catch (caught) {
        const message = caught instanceof Error ? caught.message : "The image could not be opened.";
        setError(message);
        setStatus(message);
      }
    },
    [setCanvasBase],
  );

  const createTextObject = useCallback(
    (point: Point, text: string): TextObject => ({
      id: makeId("text"),
      type: "text",
      x: point.x,
      y: point.y,
      text,
      fontFamily,
      fontSize,
      fontWeight: isBold ? "bold" : "normal",
      fontStyle: isItalic ? "italic" : "normal",
      underline: isUnderline,
      strikethrough: isStrikethrough,
      fill: color,
      opacity,
    }),
    [color, fontFamily, fontSize, isBold, isItalic, isStrikethrough, isUnderline, opacity],
  );

  const addTextAt = useCallback(
    (point: Point) => {
      if (!hasImageRef.current) return;
      const text = window.prompt("Text", "Click to edit");
      if (text === null || !text.trim()) {
        setStatus("Text cancelled");
        return;
      }

      const object = createTextObject(point, text.trim());
      commitObjects([...objectsRef.current, object]);
      selectObject(object.id);
      setTool("move");
      setStatus("Text added");
    },
    [commitObjects, createTextObject, selectObject],
  );

  const addText = useCallback(() => {
    const current = getContext();
    if (!current || !hasImageRef.current) return;
    addTextAt({ x: current.canvas.width / 2 - 80, y: current.canvas.height / 2 - fontSize / 2 });
  }, [addTextAt, fontSize, getContext]);

  const addShape = useCallback(
    (shape: Exclude<ImageEditorTool, "move" | "text" | "draw">) => {
      const current = getContext();
      if (!current || !hasImageRef.current) return;

      const centerX = current.canvas.width / 2;
      const centerY = current.canvas.height / 2;
      const object: RectObject | CircleObject | LineObject =
        shape === "line"
          ? {
              id: makeId("line"),
              type: "line",
              x1: centerX - 95,
              y1: centerY,
              x2: centerX + 95,
              y2: centerY,
              stroke: color,
              strokeWidth,
              opacity,
            }
          : {
              id: makeId(shape),
              type: shape,
              x: centerX - 90,
              y: centerY - 55,
              width: 180,
              height: 110,
              stroke: color,
              strokeWidth,
              opacity,
            };

      commitObjects([...objectsRef.current, object]);
      selectObject(object.id);
      setTool("move");
      setStatus(`${shape === "rect" ? "Rectangle" : shape === "circle" ? "Circle" : "Line"} added`);
    },
    [color, commitObjects, getContext, opacity, selectObject, strokeWidth],
  );

  const updateSelectedObject = useCallback(
    (updater: (object: EditorObject) => EditorObject) => {
      const selectedId = selectedObjectIdRef.current;
      if (!selectedId) return false;

      let didUpdate = false;
      const nextObjects = objectsRef.current.map((object) => {
        if (object.id !== selectedId) return object;
        didUpdate = true;
        return updater(object);
      });

      if (didUpdate) commitObjects(nextObjects);
      return didUpdate;
    },
    [commitObjects],
  );

  const deleteSelection = useCallback(() => {
    const selectedId = selectedObjectIdRef.current;
    if (!selectedId) {
      setStatus("Nothing selected");
      return;
    }

    commitObjects(objectsRef.current.filter((object) => object.id !== selectedId));
    selectObject(null);
    setStatus("Selection deleted");
  }, [commitObjects, selectObject]);

  const applyColorToSelection = useCallback(() => {
    const updated = updateSelectedObject((object) => {
      if (object.type === "text") {
        return {
          ...object,
          fill: color,
          fontFamily,
          fontSize,
          fontWeight: isBold ? "bold" : "normal",
          fontStyle: isItalic ? "italic" : "normal",
          underline: isUnderline,
          strikethrough: isStrikethrough,
          opacity,
        };
      }

      if (object.type === "path" || object.type === "rect" || object.type === "circle" || object.type === "line") {
        return { ...object, stroke: color, strokeWidth, opacity };
      }

      return object;
    });

    setStatus(updated ? "Selection updated" : "Choose an object first");
  }, [color, fontFamily, fontSize, isBold, isItalic, isStrikethrough, isUnderline, opacity, strokeWidth, updateSelectedObject]);

  const setSelectedTextPatch = useCallback(
    (patch: Partial<Pick<TextObject, "fontFamily" | "fontSize" | "fontWeight" | "fontStyle" | "underline" | "strikethrough">>) => {
      updateSelectedObject((object) => (object.type === "text" ? { ...object, ...patch } : object));
    },
    [updateSelectedObject],
  );

  const updateFontFamily = useCallback(
    (nextFontFamily: string) => {
      setFontFamily(nextFontFamily);
      setSelectedTextPatch({ fontFamily: nextFontFamily });
    },
    [setSelectedTextPatch],
  );

  const updateFontSize = useCallback(
    (nextFontSize: number) => {
      setFontSize(nextFontSize);
      setSelectedTextPatch({ fontSize: nextFontSize });
    },
    [setSelectedTextPatch],
  );

  const toggleBold = useCallback(() => {
    const next = !isBold;
    setIsBold(next);
    setSelectedTextPatch({ fontWeight: next ? "bold" : "normal" });
  }, [isBold, setSelectedTextPatch]);

  const toggleItalic = useCallback(() => {
    const next = !isItalic;
    setIsItalic(next);
    setSelectedTextPatch({ fontStyle: next ? "italic" : "normal" });
  }, [isItalic, setSelectedTextPatch]);

  const toggleUnderline = useCallback(() => {
    const next = !isUnderline;
    setIsUnderline(next);
    setSelectedTextPatch({ underline: next });
  }, [isUnderline, setSelectedTextPatch]);

  const toggleStrikethrough = useCallback(() => {
    const next = !isStrikethrough;
    setIsStrikethrough(next);
    setSelectedTextPatch({ strikethrough: next });
  }, [isStrikethrough, setSelectedTextPatch]);

  const makeCompositeCanvas = useCallback(
    (excludeObjectId?: string) => {
      const current = getContext();
      if (!current) throw new Error("Canvas is not available in this browser.");

      const exportCanvas = document.createElement("canvas");
      exportCanvas.width = current.canvas.width;
      exportCanvas.height = current.canvas.height;
      const exportContext = exportCanvas.getContext("2d");
      if (!exportContext) throw new Error("Canvas is not available in this browser.");

      exportContext.fillStyle = "#ffffff";
      exportContext.fillRect(0, 0, exportCanvas.width, exportCanvas.height);
      if (baseImageRef.current) exportContext.drawImage(baseImageRef.current, 0, 0, exportCanvas.width, exportCanvas.height);
      objectsRef.current.filter((object) => object.id !== excludeObjectId).forEach((object) => renderObject(exportContext, object, false));

      return exportCanvas;
    },
    [getContext],
  );

  const cropToSelection = useCallback(async () => {
    const current = getContext();
    const selectedId = selectedObjectIdRef.current;
    if (!current || !selectedId) {
      setTool("rect");
      setStatus("Draw any crop rectangle, select it, then press crop.");
      return;
    }

    const selected = objectsRef.current.find((object) => object.id === selectedId);
    if (!selected) return;

    const bounds = clampBounds(getObjectBounds(current.context, selected), current.canvas.width, current.canvas.height);
    const composite = makeCompositeCanvas(selected.type === "rect" ? selected.id : undefined);
    const cropCanvas = document.createElement("canvas");
    cropCanvas.width = bounds.width;
    cropCanvas.height = bounds.height;
    const cropContext = cropCanvas.getContext("2d");
    if (!cropContext) throw new Error("Canvas is not available in this browser.");

    cropContext.drawImage(composite, bounds.x, bounds.y, bounds.width, bounds.height, 0, 0, bounds.width, bounds.height);
    await setCanvasBase(cropCanvas.toDataURL("image/png"), imageName ?? "cropped-image.png", true);
    setStatus("Canvas cropped");
  }, [getContext, imageName, makeCompositeCanvas, setCanvasBase]);

  const cleanBackground = useCallback(async () => {
    const current = getContext();
    if (!current || !baseImageRef.current) return;

    setError(null);
    setIsProcessing(true);
    setStatus("Cleaning background...");

    try {
      const baseCanvas = document.createElement("canvas");
      baseCanvas.width = current.canvas.width;
      baseCanvas.height = current.canvas.height;
      const baseContext = baseCanvas.getContext("2d");
      if (!baseContext) throw new Error("Canvas is not available in this browser.");

      baseContext.fillStyle = "#ffffff";
      baseContext.fillRect(0, 0, baseCanvas.width, baseCanvas.height);
      baseContext.drawImage(baseImageRef.current, 0, 0, baseCanvas.width, baseCanvas.height);
      enhanceCanvas(baseCanvas, enhancementMode);

      await setCanvasBase(baseCanvas.toDataURL("image/png"), imageName ?? "cleaned-image.png", false);
      setStatus("Background cleaned");
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "The image background could not be cleaned.";
      setError(message);
      setStatus(message);
    } finally {
      setIsProcessing(false);
    }
  }, [enhancementMode, getContext, imageName, setCanvasBase]);

  const toCanvasPoint = useCallback((event: ReactPointerEvent<HTMLCanvasElement>) => {
    const canvas = event.currentTarget;
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((event.clientX - rect.left) / rect.width) * canvas.width,
      y: ((event.clientY - rect.top) / rect.height) * canvas.height,
    };
  }, []);

  const hitTest = useCallback(
    (point: Point) => {
      const current = getContext();
      if (!current) return null;

      for (let index = objectsRef.current.length - 1; index >= 0; index -= 1) {
        const object = objectsRef.current[index];
        if (objectContainsPoint(current.context, object, point)) return object;
      }

      return null;
    },
    [getContext],
  );

  const handlePointerDown = useCallback(
    (event: ReactPointerEvent<HTMLCanvasElement>) => {
      if (!hasImageRef.current) return;

      const point = toCanvasPoint(event);
      event.currentTarget.setPointerCapture(event.pointerId);
      setError(null);

      if (tool === "text") {
        addTextAt(point);
        return;
      }

      if (tool === "draw") {
        const object: PathObject = {
          id: makeId("path"),
          type: "path",
          points: [point],
          stroke: color,
          strokeWidth,
          opacity,
        };
        interactionRef.current = { kind: "draw", object };
        previewObjectRef.current = object;
        selectObject(null);
        renderCanvas();
        return;
      }

      if (tool === "rect" || tool === "circle" || tool === "line") {
        const object: RectObject | CircleObject | LineObject =
          tool === "line"
            ? {
                id: makeId("line"),
                type: "line",
                x1: point.x,
                y1: point.y,
                x2: point.x,
                y2: point.y,
                stroke: color,
                strokeWidth,
                opacity,
              }
            : {
                id: makeId(tool),
                type: tool,
                x: point.x,
                y: point.y,
                width: 1,
                height: 1,
                stroke: color,
                strokeWidth,
                opacity,
              };

        interactionRef.current = { kind: "shape", object };
        previewObjectRef.current = object;
        selectObject(null);
        renderCanvas();
        return;
      }

      const object = hitTest(point);
      selectObject(object?.id ?? null);
      if (object) {
        interactionRef.current = { kind: "move", objectId: object.id, origin: point };
        setStatus("Selection ready");
      }
    },
    [addTextAt, color, hitTest, opacity, renderCanvas, selectObject, strokeWidth, toCanvasPoint, tool],
  );

  const handlePointerMove = useCallback(
    (event: ReactPointerEvent<HTMLCanvasElement>) => {
      const interaction = interactionRef.current;
      if (!interaction) return;

      const point = toCanvasPoint(event);

      if (interaction.kind === "draw") {
        interaction.object.points.push(point);
        previewObjectRef.current = interaction.object;
        renderCanvas();
        return;
      }

      if (interaction.kind === "shape") {
        const object = interaction.object;
        if (object.type === "line") {
          previewObjectRef.current = { ...object, x2: point.x, y2: point.y };
          interaction.object = previewObjectRef.current as LineObject;
        } else {
          previewObjectRef.current = { ...object, width: point.x - object.x, height: point.y - object.y };
          interaction.object = previewObjectRef.current as RectObject | CircleObject;
        }
        renderCanvas();
        return;
      }

      if (interaction.kind === "move") {
        const dx = point.x - interaction.origin.x;
        const dy = point.y - interaction.origin.y;
        interaction.origin = point;
        objectsRef.current = objectsRef.current.map((object) => (object.id === interaction.objectId ? moveObject(object, dx, dy) : object));
        setObjects(objectsRef.current);
        renderCanvas();
      }
    },
    [renderCanvas, toCanvasPoint],
  );

  const handlePointerUp = useCallback(
    (event: ReactPointerEvent<HTMLCanvasElement>) => {
      const interaction = interactionRef.current;
      if (!interaction) return;

      try {
        event.currentTarget.releasePointerCapture(event.pointerId);
      } catch {
        // Browsers can release capture automatically when the pointer leaves the canvas.
      }

      interactionRef.current = null;
      const preview = previewObjectRef.current;
      previewObjectRef.current = null;

      if (interaction.kind === "draw" && interaction.object.points.length > 1) {
        commitObjects([...objectsRef.current, interaction.object]);
        selectObject(interaction.object.id);
        setStatus("Drawing added");
        return;
      }

      if (interaction.kind === "shape" && preview) {
        const current = getContext();
        const bounds = current ? getObjectBounds(current.context, preview) : null;
        const isUsefulLine = preview.type === "line" && Math.hypot(preview.x2 - preview.x1, preview.y2 - preview.y1) > 2;
        const isUsefulShape = preview.type !== "line" && !!bounds && bounds.width > 2 && bounds.height > 2;
        if (isUsefulLine || isUsefulShape) {
          commitObjects([...objectsRef.current, preview]);
          selectObject(preview.id);
          setTool("move");
          setStatus(`${preview.type === "rect" ? "Rectangle" : preview.type === "circle" ? "Circle" : "Line"} added`);
          return;
        }
      }

      if (interaction.kind === "move") {
        commitObjects([...objectsRef.current]);
        setStatus("Selection moved");
        return;
      }

      renderCanvas();
    },
    [commitObjects, getContext, renderCanvas, selectObject],
  );

  const handleDoubleClick = useCallback(
    (event: ReactPointerEvent<HTMLCanvasElement>) => {
      if (!hasImageRef.current) return;

      const point = toCanvasPoint(event);
      const object = hitTest(point);

      if (!object) {
        addTextAt(point);
        return;
      }

      if (object.type !== "text") return;

      const nextText = window.prompt("Edit text", object.text);
      if (nextText === null || !nextText.trim()) return;

      updateSelectedObject((candidate) => (candidate.id === object.id && candidate.type === "text" ? { ...candidate, text: nextText.trim() } : candidate));
      selectObject(object.id);
      setStatus("Text updated");
    },
    [addTextAt, hitTest, selectObject, toCanvasPoint, updateSelectedObject],
  );

  const exportFile = useCallback(
    async (format: ImageExportFormat) => {
      if (!hasImageRef.current) return;

      const exportCanvas = makeCompositeCanvas();
      const baseName = safeBaseName(imageName ?? "edited-image");

      if (format === "pdf") {
        const pdfDoc = await PDFDocument.create();
        const jpegDataUrl = exportCanvas.toDataURL("image/jpeg", 0.92);
        const image = await pdfDoc.embedJpg(await dataUrlToBlob(jpegDataUrl).arrayBuffer());
        const page = pdfDoc.addPage([image.width, image.height]);
        page.drawImage(image, { x: 0, y: 0, width: image.width, height: image.height });
        downloadBlob(new Blob([uint8ArrayToArrayBuffer(await pdfDoc.save())], { type: "application/pdf" }), `${baseName}.pdf`);
        setStatus("PDF exported");
        return;
      }

      if (format === "docx") {
        const pngBlob = dataUrlToBlob(exportCanvas.toDataURL("image/png"));
        const width = Math.min(620, exportCanvas.width);
        const height = Math.round((exportCanvas.height / exportCanvas.width) * width);
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

      const mimeType = format === "jpg" ? "image/jpeg" : `image/${format}`;
      const dataUrl = exportCanvas.toDataURL(mimeType, 0.92);
      const extension = format === "jpg" ? "jpg" : format;
      downloadBlob(dataUrlToBlob(dataUrl), `${baseName}.${extension}`);
      setStatus(`${extension.toUpperCase()} exported`);
    },
    [imageName, makeCompositeCanvas],
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
    fontFamily,
    fontSize,
    isBold,
    isItalic,
    isUnderline,
    isStrikethrough,
    enhancementMode,
    isProcessing,
    status,
    error,
    selectedObjectId,
    setTool,
    setColor,
    setStrokeWidth,
    setOpacity,
    setFontFamily: updateFontFamily,
    setFontSize: updateFontSize,
    setEnhancementMode,
    toggleBold,
    toggleItalic,
    toggleUnderline,
    toggleStrikethrough,
    loadImage,
    addText,
    addShape,
    deleteSelection,
    applyColorToSelection,
    cropToSelection,
    cleanBackground,
    exportFile,
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
    handleDoubleClick,
  };
}
