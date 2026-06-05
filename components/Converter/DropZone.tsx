"use client";

import { useState } from "react";
import { Upload } from "lucide-react";

export function DropZone({
  files,
  onFiles,
}: {
  files: File[];
  onFiles: (files: File[]) => void;
}) {
  const [dragging, setDragging] = useState(false);

  const acceptFiles = (fileList: FileList | null) => {
    if (!fileList?.length) return;
    onFiles(Array.from(fileList));
  };

  return (
    <label
      className={`tool-dropzone ${dragging ? "is-dragging" : ""}`}
      onDragOver={(event) => {
        event.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(event) => {
        event.preventDefault();
        setDragging(false);
        acceptFiles(event.dataTransfer.files);
      }}
    >
      <input
        type="file"
        multiple
        accept=".pdf,.jpg,.jpeg,.png,.webp,.gif,.docx,.txt,.html,text/html,text/plain,image/*,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        onChange={(event) => acceptFiles(event.currentTarget.files)}
      />
      <Upload size={32} aria-hidden="true" />
      <span>{files.length ? `${files.length} file${files.length === 1 ? "" : "s"} selected` : "Drop files here or click to upload"}</span>
      <small>PDF, JPG, PNG, WEBP, GIF, DOCX, TXT, HTML</small>
      {files.length ? <strong>{files.map((file) => file.name).join(", ")}</strong> : null}
    </label>
  );
}
