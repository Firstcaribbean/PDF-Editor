import { defaultCorners, Point } from "@/lib/scanner/cornerOrdering";

export function detectDocumentCorners(width: number, height: number): Point[] {
  return defaultCorners(width, height);
}
