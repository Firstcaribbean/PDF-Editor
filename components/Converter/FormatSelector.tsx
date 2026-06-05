"use client";

import { ConversionTarget } from "@/lib/converters/shared";

const targetLabels: Record<ConversionTarget, string> = {
  pdf: "PDF",
  jpg: "JPG",
  png: "PNG",
  webp: "WEBP",
  docx: "DOCX",
  txt: "TXT",
  html: "HTML",
  zip: "ZIP",
};

export function FormatSelector({
  targets,
  value,
  onChange,
}: {
  targets: ConversionTarget[];
  value: ConversionTarget | null;
  onChange: (target: ConversionTarget) => void;
}) {
  if (!targets.length) {
    return <p className="muted-status">Upload a supported file to see available formats.</p>;
  }

  return (
    <div className="format-grid" role="radiogroup" aria-label="Convert to">
      {targets.map((target) => (
        <button
          key={target}
          className={`format-button ${value === target ? "is-active" : ""}`}
          type="button"
          onClick={() => onChange(target)}
          aria-pressed={value === target}
        >
          {targetLabels[target]}
        </button>
      ))}
    </div>
  );
}
