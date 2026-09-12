import { describe, expect, test } from "@jest/globals";
import fs from "fs";
import path from "path";

/**
 * Guards against control characters landing in source files as literal bytes
 * rather than escapes.
 *
 * This has happened twice now: a staging key and a cache separator written as
 * real NUL bytes instead of escape sequences. Nothing fails at runtime, since
 * a NUL is a perfectly valid string character -- but git and grep classify the
 * file as binary, so it stops appearing in searches and diffs badly. The
 * escape is equivalent code and keeps the file text.
 *
 * The characters are built here rather than written literally, so that this
 * file cannot itself become an offender.
 */

const NUL = String.fromCharCode(0);
const NONCHARACTER = String.fromCharCode(0xffff);
const SRC = path.resolve(__dirname, "../..");

function sourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "node_modules") continue;
      out.push(...sourceFiles(full));
    } else if (/\.(ts|tsx|js|jsx)$/.test(entry.name)) {
      out.push(full);
    }
  }
  return out;
}

function filesContaining(files: string[], needle: string): string[] {
  return files
    .filter((f) => fs.readFileSync(f, "utf8").includes(needle))
    .map((f) => path.relative(SRC, f));
}

describe("source files stay text", () => {
  const files = sourceFiles(SRC);

  test("the scan actually found the source tree", () => {
    expect(files.length).toBeGreaterThan(50);
  });

  test("no file contains a literal NUL byte", () => {
    expect(filesContaining(files, NUL)).toEqual([]);
  });

  test("no file contains a literal U+FFFF", () => {
    expect(filesContaining(files, NONCHARACTER)).toEqual([]);
  });
});
