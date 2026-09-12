import { describe, expect, test } from "@jest/globals";
import JSZip from "jszip";
import { extractDocxText, htmlToMarkdown } from "../docxExtract";

// mammoth is plain CommonJS, so unlike pdf.js it loads under Jest. That means
// the whole path can be tested for real: build a .docx in memory, run the
// actual parser, assert the Markdown. No binary fixture in the repo.

const CONTENT_TYPES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`;

const RELS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`;

/** Wraps body XML into a minimal but valid .docx package. */
async function makeDocx(bodyXml: string): Promise<Blob> {
  const zip = new JSZip();
  zip.file("[Content_Types].xml", CONTENT_TYPES);
  zip.file("_rels/.rels", RELS);
  zip.file(
    "word/document.xml",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>${bodyXml}</w:body>
</w:document>`,
  );
  const bytes = await zip.generateAsync({ type: "uint8array" });
  return new Blob([bytes]);
}

const para = (text: string, style?: string) =>
  `<w:p>${
    style ? `<w:pPr><w:pStyle w:val="${style}"/></w:pPr>` : ""
  }<w:r><w:t>${text}</w:t></w:r></w:p>`;

describe("htmlToMarkdown", () => {
  test("headings become hashes at the right level", () => {
    expect(htmlToMarkdown("<h1>One</h1><h3>Three</h3>")).toBe(
      "# One\n\n### Three",
    );
  });

  test("paragraphs are separated by a blank line", () => {
    expect(htmlToMarkdown("<p>first</p><p>second</p>")).toBe("first\n\nsecond");
  });

  test("unordered lists become bullets", () => {
    expect(htmlToMarkdown("<ul><li>a</li><li>b</li></ul>")).toBe("* a\n* b");
  });

  test("ordered lists are numbered", () => {
    expect(htmlToMarkdown("<ol><li>a</li><li>b</li></ol>")).toBe("1. a\n2. b");
  });

  test("tables get the delimiter row Markdown requires", () => {
    const html =
      "<table><tr><td>A</td><td>B</td></tr><tr><td>C</td><td>D</td></tr></table>";
    expect(htmlToMarkdown(html)).toBe("| A | B |\n| --- | --- |\n| C | D |");
  });

  test("inline markup is flattened to its text", () => {
    expect(
      htmlToMarkdown("<p>plain <strong>bold</strong> and <em>italic</em></p>"),
    ).toBe("plain bold and italic");
  });

  test("unknown wrappers are descended into, not dropped", () => {
    expect(htmlToMarkdown("<div><section><p>nested</p></section></div>")).toBe(
      "nested",
    );
  });

  test("empty paragraphs and list items are dropped", () => {
    expect(htmlToMarkdown("<p></p><p>  </p><p>real</p>")).toBe("real");
    expect(htmlToMarkdown("<ul><li></li><li>real</li></ul>")).toBe("* real");
  });

  test("internal whitespace is collapsed", () => {
    expect(htmlToMarkdown("<p>lots\n\n   of    space</p>")).toBe(
      "lots of space",
    );
  });

  test("empty input yields an empty string", () => {
    expect(htmlToMarkdown("")).toBe("");
  });
});

describe("extractDocxText against real mammoth", () => {
  test("reads paragraphs", async () => {
    const docx = await makeDocx(
      para("First paragraph.") + para("Second paragraph."),
    );
    expect(await extractDocxText(docx)).toBe(
      "First paragraph.\n\nSecond paragraph.",
    );
  });

  test("headings survive as Markdown, so the Markdown chunker can split on them", async () => {
    const docx = await makeDocx(
      para("Introduction", "Heading1") +
        para("Body one.") +
        para("Details", "Heading2") +
        para("Body two."),
    );
    const text = await extractDocxText(docx);
    expect(text).toContain("# Introduction");
    expect(text).toContain("## Details");

    // The point of keeping headings: markdown_header can now chunk a Word file.
    const { markdownHeaderChunker } = await import("../browserChunkers");
    expect(markdownHeaderChunker(text, {})).toHaveLength(2);
  });

  test("unicode is preserved", async () => {
    const docx = await makeDocx(para("土 ہوا 火 — café"));
    expect(await extractDocxText(docx)).toBe("土 ہوا 火 — café");
  });

  test("XML-escaped characters are decoded", async () => {
    const docx = await makeDocx(para("a &amp; b &lt; c"));
    expect(await extractDocxText(docx)).toBe("a & b < c");
  });

  test("a document with no text is reported clearly", async () => {
    const docx = await makeDocx(para(""));
    await expect(extractDocxText(docx)).rejects.toThrow(
      /No text could be read/,
    );
  });

  test("a non-docx blob is rejected with a helpful message", async () => {
    const notDocx = new Blob([new Uint8Array([1, 2, 3, 4])]);
    await expect(extractDocxText(notDocx)).rejects.toThrow(
      /Could not read this Word document/,
    );
  });

  test("a zip that is not a Word file is rejected", async () => {
    const zip = new JSZip();
    zip.file("hello.txt", "not a word document");
    const blob = new Blob([await zip.generateAsync({ type: "uint8array" })]);
    await expect(extractDocxText(blob)).rejects.toThrow(
      /Could not read this Word document/,
    );
  });
});
