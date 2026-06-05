"use client";

import dynamic from "next/dynamic";

const ImageEditorClient = dynamic(() => import("@/components/ImageEditor/ImageEditorClient").then((module) => module.ImageEditorClient), {
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

export default function ImageEditorPage() {
  return <ImageEditorClient />;
}
