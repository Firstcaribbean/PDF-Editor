"use client";

export function ConversionProgress({
  progress,
  status,
}: {
  progress: number;
  status: string;
}) {
  return (
    <div className="progress-panel" aria-live="polite">
      <div className="progress-track">
        <span style={{ width: `${progress}%` }} />
      </div>
      <p>{status}</p>
    </div>
  );
}
