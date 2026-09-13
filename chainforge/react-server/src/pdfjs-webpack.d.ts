/**
 * pdfjs-dist ships types for its main build but not for the `webpack.mjs`
 * entry, which is the one that wires up the worker for bundlers. We only use a
 * few members of it, so declare it loosely rather than pull in a shim package.
 */
declare module "pdfjs-dist/legacy/webpack.mjs" {
  export const version: string;
  export const GlobalWorkerOptions: { workerSrc: string; workerPort?: unknown };
  export function getDocument(src: unknown): { promise: Promise<any> };
}

/**
 * mammoth ships types for its package root but not for the prebuilt browser
 * bundle, which is the entry we load (see docxExtract). Only convertToHtml is
 * used.
 */
declare module "mammoth/mammoth.browser.min.js" {
  export function convertToHtml(input: {
    arrayBuffer: ArrayBuffer;
  }): Promise<{ value: string; messages: unknown[] }>;
}
