/**
 * The scanning rules for {template variables} used to exist twice: once in
 * backend/template.ts and once in the prompt editor's highlighter. They are now
 * one function. This pins the behaviour of that function against a transcript
 * of the original implementation, so the unification cannot have changed what
 * counts as a variable or what substitution produces.
 */
import { extractTemplateVars, extractTemplateVarSpans } from "../template";
import { expect, test } from "@jest/globals";

/** The pre-unification implementation, verbatim, as the reference. */
function* originalExtractTemplateVars(
  template: string,
  sub_dict?: { [key: string]: string },
) {
  let prev_c = "";
  let group_start_idx = -1;
  for (let i = 0; i < template.length; i += 1) {
    const c = template.charAt(i);
    if (prev_c !== "\\") {
      if (group_start_idx === -1 && c === "{") group_start_idx = i;
      else if (group_start_idx > -1 && c === "\n") {
        group_start_idx = -1;
      } else if (group_start_idx > -1 && c === "}") {
        if (group_start_idx + 1 < i) {
          const varname = template.substring(group_start_idx + 1, i);
          if (!sub_dict) yield varname;
          else if (varname in sub_dict) {
            const replacement = sub_dict[varname];
            let tail = template.substring(i + 1);
            if (varname.charAt(0) === "=" && /^[ \t]*\n/.test(tail))
              tail = tail.substring(tail.indexOf("\n") + 1);
            template =
              template.substring(0, group_start_idx) + replacement + tail;
            i = group_start_idx + replacement.length - 1;
          }
        }
        group_start_idx = -1;
      }
    }
    prev_c = c;
  }
  if (sub_dict) return template;
}

function drain(gen: Generator<any, any, any>) {
  const yielded: any[] = [];
  let item = gen.next();
  while (!item.done) {
    yielded.push(item.value);
    item = gen.next();
  }
  return { yielded, returned: item.value };
}

const TEMPLATES = [
  "",
  "no variables at all",
  "{book}",
  "{}",
  "{ }",
  "What is the opening sentence of {book}?",
  "{a}{b}{c}",
  "{a} and {b} and {a}",
  "nested {outer{inner}} braces",
  "unclosed {book",
  "stray } close",
  "newline breaks {a\nb} the group",
  "escaped \\{book\\} stays literal",
  "mixed \\{literal\\} and {real}",
  "backslash at end of value \\\\{book}",
  "{=settings}\nnext line",
  "{=settings}   \nnext line",
  "{=settings} trailing text on same line",
  "before {=settings}\nafter",
  "{a}\n{=s}\n{b}",
  "adjacent}{braces",
  "{{double}}",
  "tabs\t{var}\ttabs",
  "{var with spaces}",
  "{var}{=s}\n{var}",
];

const SUB_DICTS: Array<Record<string, string>> = [
  {},
  { book: "Dune" },
  { a: "1", b: "2", c: "3" },
  { real: "X" },
  { "=settings": "" },
  { "=settings": "CFG", var: "V" },
  { outer: "O", inner: "I", "outer{inner": "WEIRD" },
  { book: "{recursive}" },
  { book: "ends with backslash\\" },
  { a: "", b: "", "=s": "" },
  { var: "value", "=s": "setting" },
];

test("variable extraction matches the original scanner", () => {
  for (const t of TEMPLATES) {
    const mine = drain(extractTemplateVars(t));
    const orig = drain(originalExtractTemplateVars(t));
    expect({ t, ...mine }).toEqual({ t, ...orig });
  }
});

test("substitution matches the original scanner", () => {
  for (const t of TEMPLATES) {
    for (const d of SUB_DICTS) {
      const mine = drain(extractTemplateVars(t, { ...d }));
      const orig = drain(originalExtractTemplateVars(t, { ...d }));
      expect({ t, d, ...mine }).toEqual({ t, d, ...orig });
    }
  }
});

test("spans point at exactly the text the scanner named", () => {
  for (const t of TEMPLATES) {
    for (const s of extractTemplateVarSpans(t)) {
      expect(t.charAt(s.start)).toBe("{");
      expect(t.charAt(s.end)).toBe("}");
      expect(t.substring(s.start + 1, s.end)).toBe(s.name);
    }
  }
});
