import { describe, expect, test, jest } from "@jest/globals";

// pdf.js is dynamically imported by extractTextInBrowser. Stub it: loading the
// real thing in Jest fails on import.meta, and these tests are about dispatch,
// not about pdf.js.
jest.mock("../pdfExtract", () => ({
  extractPdfText: (blob: Blob) =>
    Promise.resolve(`[pdf text from ${blob.size} bytes]`),
}));
jest.mock("../docxExtract", () => ({
  extractDocxText: (blob: Blob) =>
    Promise.resolve(`[docx text from ${blob.size} bytes]`),
}));

// eslint-disable-next-line import/first
import {
  browserTextExtensions,
  canExtractTextInBrowser,
  extractTextInBrowser,
  fileExtension,
  fileNameFromUID,
} from "../extractText";

// This module imports nothing from the app, so it needs no mocks.

const textFile = (contents: string, name: string) =>
  new File([contents], name, { type: "text/plain" });

describe("fileExtension", () => {
  test("returns the lowercased extension", () => {
    expect(fileExtension("report.PDF")).toBe(".pdf");
    expect(fileExtension("notes.md")).toBe(".md");
  });

  test("uses only the last extension", () => {
    expect(fileExtension("archive.tar.gz")).toBe(".gz");
  });

  test("returns empty for a file with no extension", () => {
    expect(fileExtension("README")).toBe("");
  });

  test("treats a leading dot as a dotfile, not an extension", () => {
    expect(fileExtension(".gitignore")).toBe("");
  });

  test("ignores directory components", () => {
    expect(fileExtension("some/path/to/notes.md")).toBe(".md");
    expect(fileExtension("C:\\docs\\notes.md")).toBe(".md");
  });

  test("handles an empty name", () => {
    expect(fileExtension("")).toBe("");
  });
});

describe("fileNameFromUID", () => {
  test("recovers the filename a browser uid carries", () => {
    expect(fileNameFromUID("cache__abc-123__cache__report.pdf")).toBe(
      "report.pdf",
    );
  });

  test("keeps underscores inside the filename", () => {
    expect(fileNameFromUID("cache__abc__cache__my_notes__v2.md")).toBe(
      "my_notes__v2.md",
    );
  });

  test("returns undefined for a backend uid with no filename", () => {
    expect(fileNameFromUID("a1b2c3d4e5f6")).toBeUndefined();
  });

  test("returns undefined when the filename is empty", () => {
    expect(fileNameFromUID("cache__abc__cache__")).toBeUndefined();
  });
});

describe("canExtractTextInBrowser", () => {
  test("accepts already-textual formats", () => {
    expect(canExtractTextInBrowser("notes.txt")).toBe(true);
    expect(canExtractTextInBrowser("notes.md")).toBe(true);
  });

  test("accepts PDFs, which ship a browser parser", () => {
    expect(canExtractTextInBrowser("paper.pdf")).toBe(true);
    expect(canExtractTextInBrowser("PAPER.PDF")).toBe(true);
  });

  test("accepts Word files, which ship a browser parser", () => {
    expect(canExtractTextInBrowser("memo.docx")).toBe(true);
  });

  test("rejects formats with no browser parser", () => {
    expect(canExtractTextInBrowser("sheet.xlsx")).toBe(false);
    expect(canExtractTextInBrowser("deck.pptx")).toBe(false);
    expect(canExtractTextInBrowser("old.xls")).toBe(false);
  });

  test("accepts a browser uid for a readable file", () => {
    expect(canExtractTextInBrowser("cache__x__cache__notes.md")).toBe(true);
    expect(canExtractTextInBrowser("cache__x__cache__paper.pdf")).toBe(true);
    expect(canExtractTextInBrowser("cache__x__cache__memo.docx")).toBe(true);
    expect(canExtractTextInBrowser("cache__x__cache__sheet.xlsx")).toBe(false);
  });

  test("the advertised extensions are all actually accepted", () => {
    for (const ext of browserTextExtensions())
      expect(canExtractTextInBrowser(`file${ext}`)).toBe(true);
  });
});

describe("extractTextInBrowser", () => {
  test("reads a .txt file", async () => {
    const text = await extractTextInBrowser(
      textFile("hello world", "a.txt"),
      "a.txt",
    );
    expect(text).toBe("hello world");
  });

  test("reads a .md file and preserves its markup", async () => {
    const md = "# Title\n\n- one\n- two\n";
    expect(await extractTextInBrowser(textFile(md, "a.md"), "a.md")).toBe(md);
  });

  test("preserves unicode", async () => {
    const s = "土 ہوا 火 — emoji 🎉";
    expect(await extractTextInBrowser(textFile(s, "a.txt"), "a.txt")).toBe(s);
  });

  test("takes the format from a browser uid", async () => {
    const text = await extractTextInBrowser(
      textFile("from uid", "ignored"),
      "cache__abc__cache__notes.md",
    );
    expect(text).toBe("from uid");
  });

  test("falls back to the blob's own name when no hint is given", async () => {
    expect(await extractTextInBrowser(textFile("named", "a.txt"))).toBe(
      "named",
    );
  });

  test("falls back to the MIME type when there is no extension", async () => {
    const blob = new Blob(["mime typed"], { type: "text/plain" });
    expect(await extractTextInBrowser(blob, "README")).toBe("mime typed");
  });

  test("invalid utf-8 decodes to replacement chars rather than throwing", async () => {
    // "A", a lone continuation byte, "B". Deliberately not FF FE, which is a
    // UTF-16LE byte-order mark and is decoded as such per the File API spec.
    const blob = new Blob([new Uint8Array([0x41, 0x80, 0x42])], {
      type: "text/plain",
    });
    const text = await extractTextInBrowser(blob, "a.txt");
    expect(text).toContain("A");
    expect(text).toContain("B");
  });

  test("a utf-16 byte-order mark is honoured", async () => {
    // FF FE marks UTF-16LE; "hi" is then two-byte code units.
    const blob = new Blob(
      [new Uint8Array([0xff, 0xfe, 0x68, 0x00, 0x69, 0x00])],
      { type: "text/plain" },
    );
    expect(await extractTextInBrowser(blob, "a.txt")).toBe("hi");
  });

  test("an empty file yields an empty string", async () => {
    expect(await extractTextInBrowser(textFile("", "a.txt"), "a.txt")).toBe("");
  });

  describe("formats needing the backend", () => {
    test.each([".xlsx", ".xls", ".pptx"])(
      "%s explains that a local server is required",
      async (ext) => {
        const blob = new Blob([new Uint8Array([1, 2, 3])]);
        await expect(extractTextInBrowser(blob, `doc${ext}`)).rejects.toThrow(
          /requires the local ChainForge server/,
        );
      },
    );

    test("the message names the readable alternatives", async () => {
      const blob = new Blob([new Uint8Array([1, 2, 3])]);
      await expect(extractTextInBrowser(blob, "sheet.xlsx")).rejects.toThrow(
        /\.docx, \.md, \.pdf, \.txt/,
      );
    });
  });

  test("a .pdf is handed to the PDF parser", async () => {
    const blob = new Blob([new Uint8Array(1024)], { type: "application/pdf" });
    expect(await extractTextInBrowser(blob, "paper.pdf")).toBe(
      "[pdf text from 1024 bytes]",
    );
  });

  test("a PDF is recognised by MIME type when it has no extension", async () => {
    const blob = new Blob([new Uint8Array(8)], { type: "application/pdf" });
    expect(await extractTextInBrowser(blob, "noextension")).toBe(
      "[pdf text from 8 bytes]",
    );
  });

  test("a .docx is handed to the Word parser", async () => {
    const blob = new Blob([new Uint8Array(256)]);
    expect(await extractTextInBrowser(blob, "memo.docx")).toBe(
      "[docx text from 256 bytes]",
    );
  });

  test("an unknown format is rejected with the supported list", async () => {
    const blob = new Blob(["?"], { type: "application/octet-stream" });
    await expect(extractTextInBrowser(blob, "thing.xyz")).rejects.toThrow(
      /Supported formats here are/,
    );
  });

  test("a binary blob with no name or type is rejected, not silently decoded", async () => {
    const blob = new Blob([new Uint8Array([0, 1, 2])]);
    await expect(extractTextInBrowser(blob)).rejects.toThrow(
      /Cannot read text/,
    );
  });
});

describe("which extensions each mode offers", () => {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const mod = require("../extractText");

  test("the browser offers only what it can parse itself", () => {
    expect(mod.browserTextExtensions().sort()).toEqual([
      ".docx",
      ".md",
      ".pdf",
      ".txt",
    ]);
  });

  test("a local server also offers the formats markitdown handles", () => {
    // markitdown is a core dependency, not part of the `rag` extra, so these
    // work even on an install without RAG. The Upload node used to promise
    // these in its hint text while refusing to accept them.
    expect(mod.backendTextExtensions()).toEqual(
      expect.arrayContaining([".xlsx", ".xls", ".pptx"]),
    );
  });

  test("the server list is a superset of the browser list", () => {
    const backend = new Set(mod.backendTextExtensions());
    for (const ext of mod.browserTextExtensions())
      expect(backend.has(ext)).toBe(true);
  });
});
