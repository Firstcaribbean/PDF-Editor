# Inline PDF Editor

A free, client-side PDF editor built with Next.js, PDF.js, and pdf-lib. Users can upload a PDF, edit detected text in place, replace detected images, and download an edited PDF without sending the document to a server.

## Features

- PDF upload by drag/drop or file picker, up to 50 MB
- PDF.js canvas rendering for the visual reference layer
- Absolutely positioned editable overlay for extracted text blocks
- Click-to-replace image regions for common embedded PDF images
- Multi-page rendering with a page thumbnail sidebar
- Zoom, page navigation, dirty edit count, reset edits, and download
- Client-side IndexedDB storage for the current file
- Scanned/image-only PDF warning when no editable content is detected
- Built-in sample PDF for quick smoke testing

## Local Development

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## Verification

```bash
npm run check
```

This runs linting, TypeScript checking, and the production build.

## Deploy To Vercel

This project is ready for Vercel with no environment variables.

1. Push the repository to GitHub.
2. Import the repo in Vercel with a lowercase project name such as `inline-pdf-editor`.
3. Keep the default Next.js framework detection.
4. Deploy.

Vercel will run `npm install` and `npm run build` from `vercel.json`.

If deploying with the Vercel CLI from this local folder, link it first with a valid project slug:

```bash
vercel link --project inline-pdf-editor
vercel build
vercel deploy --prebuilt
```

## Notes

The app runs entirely in the browser. For text edits, the exporter covers the original changed text region with the sampled page background color and redraws the replacement text in the same PDF coordinates. This preserves the rest of the original document bytes and visual layout. Exact embedded-font rewriting is limited by what browsers and pdf-lib can access from arbitrary PDFs.
