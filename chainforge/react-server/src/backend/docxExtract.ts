/**
 * Word (.docx) text extraction in the browser, via mammoth.
 *
 * Loaded on demand, like the PDF reader, so sessions that never open a Word
 * file don't pay for it.
 *
 * Produces Markdown rather than flat text. mammoth can hand back raw text
 * directly, but that discards headings, lists and tables -- and headings are
 * worth keeping, because the Markdown chunker can then split a Word document
 * by section. It also lands very close to what the backend produces, since
 * markitdown converts .docx to Markdown too.
 */

import { readBlobAsArrayBuffer } from "./blobRead";

/** Collapses inline whitespace the way a Markdown block wants it. */
function inlineText(el: Element): string {
  return (el.textContent ?? "").replace(/\s+/g, " ").trim();
}

/**
 * Converts mammoth's HTML into Markdown.
 *
 * Uses DOMParser rather than regexes: it is built into every browser (and into
 * jsdom, so this is directly testable), and HTML is not a regular language.
 */
export function htmlToMarkdown(html: string): string {
  const parser = new DOMParser();
  const doc = parser.parseFromString(`<body>${html}</body>`, "text/html");
  const blocks: string[] = [];

  const walk = (node: Element | HTMLElement): void => {
    for (const el of Array.from(node.children)) {
      const tag = el.tagName.toLowerCase();
      const heading = /^h([1-6])$/.exec(tag);

      if (heading) {
        const text = inlineText(el);
        if (text) blocks.push(`${"#".repeat(Number(heading[1]))} ${text}`);
      } else if (tag === "p") {
        const text = inlineText(el);
        if (text) blocks.push(text);
      } else if (tag === "ul" || tag === "ol") {
        const items = Array.from(el.children)
          .map((li, i) =>
            tag === "ol"
              ? `${i + 1}. ${inlineText(li)}`
              : `* ${inlineText(li)}`,
          )
          .filter((line) => line.replace(/^([*]|\d+\.)\s*/, "").length > 0);
        if (items.length) blocks.push(items.join("\n"));
      } else if (tag === "table") {
        const rows = Array.from(el.querySelectorAll("tr")).map(
          (tr) =>
            "| " +
            Array.from(tr.children)
              .map((cell) => inlineText(cell))
              .join(" | ") +
            " |",
        );
        if (rows.length > 0) {
          // Markdown needs a delimiter row, or the table renders as one line.
          const columns = (rows[0].match(/\|/g)?.length ?? 2) - 1;
          rows.splice(1, 0, `| ${Array(columns).fill("---").join(" | ")} |`);
          blocks.push(rows.join("\n"));
        }
      } else {
        // Unknown wrapper (div, section, a, span...): keep descending so its
        // block-level children are still picked up.
        walk(el);
      }
    }
  };

  walk(doc.body);
  return blocks
    .join("\n\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * Reads the text of a .docx file as Markdown.
 *
 * @throws If the file cannot be read as a Word document.
 */
export async function extractDocxText(blob: Blob): Promise<string> {
  let mammoth: any;
  try {
    // The prebuilt browser bundle, not the package root. mammoth's node entry
    // accepts {path}/{buffer} while only the browser entry accepts
    // {arrayBuffer}; naming the browser build explicitly means the same code
    // runs in the app and under Jest (whose resolution would otherwise pick
    // the node entry and reject the input).
    mammoth = await import("mammoth/mammoth.browser.min.js");
  } catch (err) {
    throw new Error(
      `Could not load the Word reader: ${(err as Error).message}. ` +
        `Try reloading the page, or run ChainForge locally to read .docx ` +
        `files server-side.`,
    );
  }

  const arrayBuffer = await readBlobAsArrayBuffer(blob);

  let html: string;
  try {
    const result = await (mammoth.default ?? mammoth).convertToHtml({
      arrayBuffer,
    });
    html = result.value ?? "";
  } catch (err) {
    throw new Error(
      `Could not read this Word document: ${(err as Error).message}. ` +
        `It may be corrupt, or an older .doc file rather than .docx.`,
    );
  }

  const markdown = htmlToMarkdown(html);
  if (markdown.length === 0)
    throw new Error(
      "No text could be read from this Word document. It may be empty, or " +
        "contain only images.",
    );
  return markdown;
}
