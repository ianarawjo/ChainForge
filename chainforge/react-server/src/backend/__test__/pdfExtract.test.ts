import { describe, expect, test } from "@jest/globals";
import { assemblePageText, tidyPdfText } from "../pdfExtract";

// Only the pure text-assembly functions are exercised here. extractPdfText
// itself dynamically imports pdf.js, whose `webpack.mjs` entry contains
// `import.meta` that CRA's Jest cannot parse -- and running the real parser
// would test pdf.js rather than our code. The browser path was verified
// end-to-end against a real PDF in a real browser (module worker included);
// what is worth pinning here is how runs become text.

describe("assemblePageText", () => {
  // These item shapes are what pdf.js actually returned for a generated PDF:
  // positioned runs, with hasEOL marking line ends, plus empty runs for blank
  // lines.
  test("honours hasEOL rather than joining with spaces", () => {
    const items = [
      { str: "Introduction", hasEOL: false },
      { str: "", hasEOL: true },
      { str: "Retrieval augmented generation grounds a model", hasEOL: true },
      { str: "in source documents.", hasEOL: true },
    ];
    expect(assemblePageText(items)).toBe(
      "Introduction\nRetrieval augmented generation grounds a model\nin source documents.",
    );
  });

  test("does not insert spaces between runs on the same line", () => {
    // Joining with " " is the obvious-but-wrong approach: it mangles words
    // split across runs, which is common with kerning or styled spans.
    const items = [
      { str: "hyphen", hasEOL: false },
      { str: "ated", hasEOL: false },
      { str: " word", hasEOL: true },
    ];
    expect(assemblePageText(items)).toBe("hyphenated word");
  });

  test("items missing str are skipped", () => {
    const items = [{ hasEOL: false }, { str: "text", hasEOL: false }];
    expect(assemblePageText(items)).toBe("text");
  });

  test("leading and trailing whitespace is trimmed", () => {
    expect(assemblePageText([{ str: "  padded  ", hasEOL: true }])).toBe(
      "padded",
    );
  });

  test("an empty page yields an empty string", () => {
    expect(assemblePageText([])).toBe("");
  });

  test("a page of only blank runs yields an empty string", () => {
    expect(
      assemblePageText([
        { str: "", hasEOL: true },
        { str: "   ", hasEOL: true },
      ]),
    ).toBe("");
  });
});

describe("tidyPdfText", () => {
  test("joins pages with a blank line between them", () => {
    expect(tidyPdfText(["page one", "page two"])).toBe("page one\n\npage two");
  });

  test("drops empty pages rather than leaving gaps", () => {
    expect(tidyPdfText(["first", "", "third"])).toBe("first\n\nthird");
  });

  test("collapses runs of three or more newlines", () => {
    expect(tidyPdfText(["a\n\n\n\n\nb"])).toBe("a\n\nb");
  });

  test("normalizes CRLF", () => {
    expect(tidyPdfText(["a\r\nb"])).toBe("a\nb");
  });

  test("a document with no extractable text yields an empty string", () => {
    // extractPdfText turns this into a "may be a scan" error for the user.
    expect(tidyPdfText(["", ""])).toBe("");
  });

  test("single page passes through trimmed", () => {
    expect(tidyPdfText(["  only page  "])).toBe("only page");
  });
});
