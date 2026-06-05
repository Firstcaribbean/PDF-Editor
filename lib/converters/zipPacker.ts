import JSZip from "jszip";
import { ConversionOutput, safeBaseName } from "@/lib/converters/shared";

export async function packFilesAsZip(files: File[], zipName = "files.zip") {
  const zip = new JSZip();
  for (const file of files) {
    zip.file(file.name, file);
  }
  return {
    blob: await zip.generateAsync({ type: "blob" }),
    fileName: zipName,
    mimeType: "application/zip",
  } satisfies ConversionOutput;
}

export async function packOutputsAsZip(outputs: ConversionOutput[], baseName = "converted") {
  const zip = new JSZip();
  for (const output of outputs) {
    zip.file(output.fileName, output.blob);
  }
  return {
    blob: await zip.generateAsync({ type: "blob" }),
    fileName: `${safeBaseName(baseName)}.zip`,
    mimeType: "application/zip",
  } satisfies ConversionOutput;
}
