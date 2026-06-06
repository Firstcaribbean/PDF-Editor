"use client";

import { Bold, Circle, Crop, Eraser, Italic, Move, Pencil, Slash, Sparkles, Square, Strikethrough, Trash2, Type, Underline } from "lucide-react";
import { imageEditorFontOptions, useImageEditor } from "@/hooks/useImageEditor";

export function ImageToolbar({
  editor,
}: {
  editor: ReturnType<typeof useImageEditor>;
}) {
  return (
    <aside className="tool-panel image-toolbar" aria-label="Image tools">
      <div className="panel-heading">
        <span>Tools</span>
        <small>{editor.imageName ?? "No image"}</small>
      </div>

      <div className="icon-grid">
        <button className={`icon-button ${editor.tool === "move" ? "is-active" : ""}`} type="button" onClick={() => editor.setTool("move")} title="Move">
          <Move size={17} aria-hidden="true" />
        </button>
        <button className="icon-button" type="button" onClick={editor.addText} disabled={!editor.hasImage} title="Text">
          <Type size={17} aria-hidden="true" />
        </button>
        <button className={`icon-button ${editor.tool === "draw" ? "is-active" : ""}`} type="button" onClick={() => editor.setTool("draw")} disabled={!editor.hasImage} title="Draw">
          <Pencil size={17} aria-hidden="true" />
        </button>
        <button className="icon-button" type="button" onClick={() => editor.addShape("rect")} disabled={!editor.hasImage} title="Rectangle">
          <Square size={17} aria-hidden="true" />
        </button>
        <button className="icon-button" type="button" onClick={() => editor.addShape("circle")} disabled={!editor.hasImage} title="Circle">
          <Circle size={17} aria-hidden="true" />
        </button>
        <button className="icon-button" type="button" onClick={() => editor.addShape("line")} disabled={!editor.hasImage} title="Line">
          <Slash size={17} aria-hidden="true" />
        </button>
        <button className="icon-button" type="button" onClick={editor.cropToSelection} disabled={!editor.hasImage} title="Crop to selection">
          <Crop size={17} aria-hidden="true" />
        </button>
        <button className="icon-button" type="button" onClick={editor.deleteSelection} disabled={!editor.hasImage} title="Delete">
          <Trash2 size={17} aria-hidden="true" />
        </button>
      </div>

      <label className="field-row">
        <span>Color</span>
        <input type="color" value={editor.color} onChange={(event) => editor.setColor(event.currentTarget.value)} />
      </label>
      <label className="field-row stacked">
        <span>Font</span>
        <select value={editor.fontFamily} onChange={(event) => editor.setFontFamily(event.currentTarget.value)} disabled={!editor.hasImage}>
          {imageEditorFontOptions.map((fontFamily) => (
            <option key={fontFamily} value={fontFamily}>
              {fontFamily}
            </option>
          ))}
        </select>
      </label>
      <label className="field-row">
        <span>Size</span>
        <input type="range" min="8" max="120" value={editor.fontSize} onChange={(event) => editor.setFontSize(Number(event.currentTarget.value))} disabled={!editor.hasImage} />
      </label>
      <div className="text-style-row" aria-label="Text styles">
        <button className={`icon-button ${editor.isBold ? "is-active" : ""}`} type="button" onClick={editor.toggleBold} disabled={!editor.hasImage} title="Bold">
          <Bold size={16} aria-hidden="true" />
        </button>
        <button className={`icon-button ${editor.isItalic ? "is-active" : ""}`} type="button" onClick={editor.toggleItalic} disabled={!editor.hasImage} title="Italic">
          <Italic size={16} aria-hidden="true" />
        </button>
        <button className={`icon-button ${editor.isUnderline ? "is-active" : ""}`} type="button" onClick={editor.toggleUnderline} disabled={!editor.hasImage} title="Underline">
          <Underline size={16} aria-hidden="true" />
        </button>
        <button className={`icon-button ${editor.isStrikethrough ? "is-active" : ""}`} type="button" onClick={editor.toggleStrikethrough} disabled={!editor.hasImage} title="Strikethrough">
          <Strikethrough size={16} aria-hidden="true" />
        </button>
      </div>
      <label className="field-row">
        <span>Stroke</span>
        <input type="range" min="1" max="24" value={editor.strokeWidth} onChange={(event) => editor.setStrokeWidth(Number(event.currentTarget.value))} />
      </label>
      <label className="field-row">
        <span>Opacity</span>
        <input type="range" min="0.1" max="1" step="0.05" value={editor.opacity} onChange={(event) => editor.setOpacity(Number(event.currentTarget.value))} />
      </label>
      <button className="secondary-button" type="button" onClick={editor.applyColorToSelection} disabled={!editor.hasImage}>
        <Eraser size={17} aria-hidden="true" />
        <span>Apply Style</span>
      </button>
      <label className="field-row stacked">
        <span>Clean</span>
        <select value={editor.enhancementMode} onChange={(event) => editor.setEnhancementMode(event.currentTarget.value as typeof editor.enhancementMode)} disabled={!editor.hasImage || editor.isProcessing}>
          <option value="auto">Auto</option>
          <option value="bw">Black &amp; white</option>
          <option value="grayscale">Grayscale</option>
          <option value="color">Color clean</option>
          <option value="photo">Photo</option>
        </select>
      </label>
      <button className="secondary-button" type="button" onClick={editor.cleanBackground} disabled={!editor.hasImage || editor.isProcessing}>
        <Sparkles size={17} aria-hidden="true" />
        <span>{editor.isProcessing ? "Cleaning" : "Clean Background"}</span>
      </button>
    </aside>
  );
}
