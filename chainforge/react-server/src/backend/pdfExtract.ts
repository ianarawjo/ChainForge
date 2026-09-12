/**
 * PDF text extraction in the browser, via pdf.js.
 *
 * Separate module, loaded on demand: pdf.js is by far the largest dependency
 * here, and most sessions never open a PDF. Keeping it behind a dynamic import
 * means it only reaches users who actually need it.
 *
 * Note this does NOT match the backend byte for byte, and cannot. With a local
 * server, /mediaToText uses markitdown (PyMuPDF), a different engine with
 * different layout heuristics. So unlike the markdown chunker -- which is a
 * verified port shared by both modes -- PDF extraction is the backend's job
 * whenever a backend exists, and this is the fallback. Extracted text will
 * differ slightly between the two, mostly in blank-line placement.
 */

/** One text run as pdf.js reports it. */
interface PdfTextItem {
  str?: string;
  /** pdf.js sets this when a line break follows the run. */
  hasEOL?: boolean;
}

/**
 * Loads pdf.js.
 *
 * Imports the `webpack.mjs` entry rather than the plain build: it wires up the
 * worker itself, with
 * `new Worker(new URL("./build/pdf.worker.mjs", import.meta.url), {type:"module"})`.
 * Because that `import.meta` lives inside node_modules, webpack resolves and
 * emits the worker chunk, and none of our own source has to contain
 * `import.meta` -- which CRA's Jest cannot parse.
 *
 * The `legacy` variant targets older syntax, which matters for Safari.
 */
async function loadPdfJs(): Promise<any> {
  try {
    return await import("pdfjs-dist/legacy/webpack.mjs");
  } catch (err) {
    throw new Error(
      `Could not load the PDF reader: ${(err as Error).message}. ` +
        `Try reloading the page, or run ChainForge locally to read PDFs ` +
        `server-side.`,
    );
  }
}

/**
 * Assembles one page's text runs into text.
 *
 * pdf.js hands back positioned runs, not lines. Concatenating them with spaces
 * mangles words that span runs and loses line structure; honouring `hasEOL`
 * keeps the original line breaks, which is what makes heading- and
 * sentence-based chunking behave sensibly afterwards.
 */
export function assemblePageText(items: PdfTextItem[]): string {
  let text = "";
  for (const item of items) {
    text += item.str ?? "";
    if (item.hasEOL) text += "\n";
  }
  return text.trim();
}

/** Tidies assembled text: collapse runs of blank lines, normalize endings. */
export function tidyPdfText(pages: string[]): string {
  return pages
    .filter((page) => page.length > 0)
    .join("\n\n")
    .replace(/\r\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * Reads the text of a PDF.
 *
 * Known limits of the browser path, both handled better by the backend:
 * - Scanned PDFs have no text layer, so they come back empty; there is no OCR.
 * - CJK documents relying on external character maps may extract poorly, since
 *   pdf.js's cMap files are not bundled.
 *
 * @throws If the file cannot be parsed as a PDF.
 */
export async function extractPdfText(blob: Blob): Promise<string> {
  const pdfjs = await loadPdfJs();
  const data = new Uint8Array(await blob.arrayBuffer());

  let doc: any;
  try {
    doc = await pdfjs.getDocument({
      data,
      // Don't let a document's own JavaScript evaluate; we only want text.
      isEvalSupported: false,
    }).promise;
  } catch (err) {
    throw new Error(
      `Could not read this PDF: ${(err as Error).message}. ` +
        `It may be corrupt, or password protected.`,
    );
  }

  try {
    const pages: string[] = [];
    for (let pageNum = 1; pageNum <= doc.numPages; pageNum++) {
      const page = await doc.getPage(pageNum);
      const content = await page.getTextContent();
      pages.push(assemblePageText(content.items as PdfTextItem[]));
      // Release the page's operator list; long documents otherwise accumulate.
      page.cleanup?.();
    }

    const text = tidyPdfText(pages);
    if (text.length === 0)
      throw new Error(
        "No text could be read from this PDF. It may be a scan or an image, " +
          "which needs OCR -- not available in the browser.",
      );
    return text;
  } finally {
    doc.cleanup?.();
  }
}
