const a4Portrait = {
  width: 595.28,
  height: 841.89,
};

export type ImagePdfLayout = {
  pageWidth: number;
  pageHeight: number;
  imageLeft: number;
  imageTop: number;
  imageWidth: number;
  imageHeight: number;
  scale: number;
};

export function getImagePdfLayout(imageWidth: number, imageHeight: number): ImagePdfLayout {
  const isLandscape = imageWidth > imageHeight;
  const pageWidth = isLandscape ? a4Portrait.height : a4Portrait.width;
  const pageHeight = isLandscape ? a4Portrait.width : a4Portrait.height;
  const scale = Math.min(pageWidth / imageWidth, pageHeight / imageHeight);
  const fittedWidth = imageWidth * scale;
  const fittedHeight = imageHeight * scale;

  return {
    pageWidth,
    pageHeight,
    imageLeft: (pageWidth - fittedWidth) / 2,
    imageTop: (pageHeight - fittedHeight) / 2,
    imageWidth: fittedWidth,
    imageHeight: fittedHeight,
    scale,
  };
}

export function mapImageRectToPdfPage(
  layout: ImagePdfLayout,
  rect: {
    left: number;
    top: number;
    width: number;
    height: number;
  },
) {
  const rawLeft = layout.imageLeft + rect.left * layout.scale;
  const rawTop = layout.imageTop + rect.top * layout.scale;
  const rawRight = rawLeft + rect.width * layout.scale;
  const rawBottom = rawTop + rect.height * layout.scale;
  const left = Math.max(0, Math.min(layout.pageWidth - 1, rawLeft));
  const top = Math.max(0, Math.min(layout.pageHeight - 1, rawTop));
  const right = Math.max(left + 1, Math.min(layout.pageWidth, rawRight));
  const bottom = Math.max(top + 1, Math.min(layout.pageHeight, rawBottom));
  const width = right - left;
  const height = bottom - top;

  return {
    screen: {
      left,
      top,
      width,
      height,
    },
    pdf: {
      x: left,
      y: layout.pageHeight - top - height,
      width,
      height,
    },
  };
}
