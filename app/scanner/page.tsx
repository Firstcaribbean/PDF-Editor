"use client";

import dynamic from "next/dynamic";

const ScannerClient = dynamic(() => import("@/components/Scanner/ScannerClient").then((module) => module.ScannerClient), {
  ssr: false,
  loading: () => (
    <main className="editor-loading">
      <div className="loading-panel">
        <div className="skeleton skeleton-title" />
        <div className="skeleton skeleton-line" />
        <div className="skeleton skeleton-page" />
      </div>
    </main>
  ),
});

export default function ScannerPage() {
  return <ScannerClient />;
}
