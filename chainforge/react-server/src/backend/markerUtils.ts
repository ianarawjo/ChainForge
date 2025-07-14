import { extractBracketedSubstrings } from "../TemplateHooksComponent";

export class markerUtils {
  static detectParameter(
    textSelection: any,
    fieldValues: Record<string, string>,
    markerSet: Set<string>,
  ): string | null {
    if (!textSelection) return null;

    const { start, end, id: fieldId } = textSelection;
    const full = fieldValues[fieldId] ?? "";
    const slice = full.slice(start, end);
    const raw = slice.replace(/[{}]/g, "").trim();

    let param: string | null = null;

    // Exact match with a bracketed parameter
    const inside = extractBracketedSubstrings(slice);
    if (inside.length === 1 && `{${inside[0]}}` === slice) {
      param = inside[0];
    }
    // Raw text matches a known marker
    else if (markerSet.has(raw)) {
      param = raw;
    }
    // Selection is inside a larger bracketed parameter
    else {
      const allBracketedParams = extractBracketedSubstrings(full) || [];

      for (const bracketedParam of allBracketedParams) {
        const bracketedSpan = `{${bracketedParam}}`;
        let searchStart = 0;
        let bracketedIndex = full.indexOf(bracketedSpan, searchStart);

        while (bracketedIndex !== -1) {
          const bracketedStart = bracketedIndex;
          const bracketedEnd = bracketedIndex + bracketedSpan.length;

          if (start >= bracketedStart && end <= bracketedEnd) {
            if (slice !== bracketedSpan) {
              param = bracketedParam;
              break;
            }
          }

          searchStart = bracketedIndex + 1;
          bracketedIndex = full.indexOf(bracketedSpan, searchStart);
        }

        if (param) break;
      }
    }

    return param;
  }

  static setsAreEqual(setA: Set<any>, setB: Set<any>): boolean {
    if (setA.size !== setB.size) return false;
    for (const item of setA) {
      if (!setB.has(item)) return false;
    }
    return true;
  }
}
