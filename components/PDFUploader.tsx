"use client";

import { ChangeEvent, DragEvent, useRef, useState } from "react";
import { FileText, UploadCloud } from "lucide-react";
import { isPDFEditorInput, pdfEditorInputAccept } from "@/lib/pdfEditorInput";

const MAX_SIZE = 50 * 1024 * 1024;

type PDFUploaderProps = {
  onFile: (file: File) => void | Promise<void>;
  compact?: boolean;
  disabled?: boolean;
};

function validateFile(file: File) {
  if (!isPDFEditorInput(file)) {
    return "Choose a PDF or image file.";
  }

  if (file.size > MAX_SIZE) {
    return "File must be 50 MB or smaller.";
  }

  return null;
}

export function PDFUploader({ onFile, compact = false, disabled = false }: PDFUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFile = async (file?: File) => {
    if (!file || disabled) return;

    const validationError = validateFile(file);
    if (validationError) {
      setError(validationError);
      return;
    }

    setError(null);
    await onFile(file);
  };

  const handleInput = (event: ChangeEvent<HTMLInputElement>) => {
    void handleFile(event.target.files?.[0]);
    event.target.value = "";
  };

  const handleDrop = (event: DragEvent<HTMLButtonElement>) => {
    event.preventDefault();
    setIsDragging(false);
    void handleFile(event.dataTransfer.files?.[0]);
  };

  if (compact) {
    return (
      <label className="toolbar-file-button" title="Open PDF">
        <UploadCloud size={17} aria-hidden="true" />
        <span>Open</span>
        <input ref={inputRef} type="file" accept={pdfEditorInputAccept} onChange={handleInput} disabled={disabled} />
      </label>
    );
  }

  return (
    <div className="uploader-wrap">
      <button
        className={`uploader ${isDragging ? "is-dragging" : ""}`}
        type="button"
        onClick={() => inputRef.current?.click()}
        onDragOver={(event) => {
          event.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        disabled={disabled}
      >
        <span className="uploader-icon">
          <FileText size={34} aria-hidden="true" />
        </span>
        <span className="uploader-title">Drop a PDF or image here</span>
        <span className="uploader-subtitle">PDF, JPG, PNG, WEBP, or GIF up to 50 MB</span>
      </button>
      <input ref={inputRef} type="file" accept={pdfEditorInputAccept} onChange={handleInput} disabled={disabled} hidden />
      {error ? <p className="field-error">{error}</p> : null}
    </div>
  );
}
