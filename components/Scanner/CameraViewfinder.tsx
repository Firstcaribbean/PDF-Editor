"use client";

import { Camera } from "lucide-react";
import { useScanner } from "@/hooks/useScanner";

export function CameraViewfinder({
  scanner,
}: {
  scanner: ReturnType<typeof useScanner>;
}) {
  return (
    <div className="camera-viewfinder">
      <video ref={scanner.videoRef} playsInline muted className={scanner.isCameraActive ? "" : "is-hidden"} />
      {!scanner.isCameraActive ? (
        <div className="camera-placeholder">
          <Camera size={30} aria-hidden="true" />
          <span>Camera preview</span>
        </div>
      ) : null}
    </div>
  );
}
