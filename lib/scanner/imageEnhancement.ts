export type EnhancementMode = "auto" | "bw" | "grayscale" | "color" | "photo";

function clampChannel(value: number) {
  return Math.max(0, Math.min(255, value));
}

export function enhanceCanvas(canvas: HTMLCanvasElement, mode: EnhancementMode) {
  if (mode === "photo") return canvas;

  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas is not available in this browser.");

  const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;
  let totalLuminance = 0;

  for (let index = 0; index < data.length; index += 4) {
    totalLuminance += data[index] * 0.299 + data[index + 1] * 0.587 + data[index + 2] * 0.114;
  }

  const average = totalLuminance / (data.length / 4);
  const threshold = mode === "bw" ? average * 0.96 : average * 0.9;

  for (let index = 0; index < data.length; index += 4) {
    const red = data[index];
    const green = data[index + 1];
    const blue = data[index + 2];
    const luminance = red * 0.299 + green * 0.587 + blue * 0.114;

    if (mode === "bw" || mode === "auto") {
      const value = luminance > threshold ? 255 : 0;
      data[index] = value;
      data[index + 1] = value;
      data[index + 2] = value;
    }

    if (mode === "grayscale") {
      const boosted = clampChannel((luminance - 128) * 1.18 + 132);
      data[index] = boosted;
      data[index + 1] = boosted;
      data[index + 2] = boosted;
    }

    if (mode === "color") {
      data[index] = clampChannel((red - 128) * 1.08 + 140);
      data[index + 1] = clampChannel((green - 128) * 1.08 + 140);
      data[index + 2] = clampChannel((blue - 128) * 1.08 + 140);
    }
  }

  context.putImageData(imageData, 0, 0);
  return canvas;
}
