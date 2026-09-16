import React, {
  forwardRef,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Textarea, TextareaProps, useMantineTheme } from "@mantine/core";

export interface TemplateSegment {
  text: string;
  isVar: boolean;
  /** The name inside the braces, for variable segments. */
  name?: string;
}

/**
 * Splits a prompt template into plain and {variable} segments.
 *
 * This deliberately mirrors the scanning in extractTemplateVars
 * (backend/template.ts) character for character: braces escaped with a
 * backslash are literal, an open group is abandoned at a newline, and {} is
 * ignored. Highlighting something the engine will not actually substitute is
 * worse than not highlighting at all, so the two must stay in step.
 */
export function splitTemplateVars(template: string): TemplateSegment[] {
  const segments: TemplateSegment[] = [];
  let prevChar = "";
  let groupStartIdx = -1;
  let plainFrom = 0;

  for (let i = 0; i < template.length; i += 1) {
    const c = template.charAt(i);
    if (prevChar !== "\\") {
      if (groupStartIdx === -1 && c === "{") groupStartIdx = i;
      else if (groupStartIdx > -1 && c === "\n") groupStartIdx = -1;
      else if (groupStartIdx > -1 && c === "}") {
        if (groupStartIdx + 1 < i) {
          if (groupStartIdx > plainFrom)
            segments.push({
              text: template.substring(plainFrom, groupStartIdx),
              isVar: false,
            });
          segments.push({
            text: template.substring(groupStartIdx, i + 1),
            isVar: true,
            name: template.substring(groupStartIdx + 1, i),
          });
          plainFrom = i + 1;
        }
        groupStartIdx = -1;
      }
    }
    prevChar = c;
  }

  if (plainFrom < template.length)
    segments.push({ text: template.substring(plainFrom), isVar: false });

  return segments;
}

/* Properties that must match for the backdrop's text to land exactly under the
   textarea's own. Copied off the live element rather than duplicated in CSS,
   so this cannot drift out of step with Mantine's input styles. */
const MIRRORED_PROPS = [
  "fontFamily",
  "fontSize",
  "fontWeight",
  "fontStyle",
  "lineHeight",
  "letterSpacing",
  "wordSpacing",
  "textIndent",
  "textTransform",
  "paddingTop",
  "paddingRight",
  "paddingBottom",
  "paddingLeft",
  "borderTopWidth",
  "borderRightWidth",
  "borderBottomWidth",
  "borderLeftWidth",
  "boxSizing",
  "tabSize",
] as const;

export interface TemplateHighlightTextareaProps extends TextareaProps {
  /** Change this to re-read the textarea after the value is set imperatively
      (PromptNode assigns .value directly when the variant changes). */
  syncKey?: string | number;
}

/**
 * A Textarea that tints {template_variables} behind the text.
 *
 * A textarea cannot style its own content, so the text is drawn twice: once in
 * a backdrop div that carries the highlight spans, and once in the textarea
 * itself with a transparent background on top of it. The textarea's text stays
 * the real, selectable, caret-bearing one.
 */
const TemplateHighlightTextarea = forwardRef<
  HTMLTextAreaElement,
  TemplateHighlightTextareaProps
>(function TemplateHighlightTextarea(props, ref) {
  const { className, syncKey, onChange, styles, ...rest } = props;
  const theme = useMantineTheme();
  const areaRef = useRef<HTMLTextAreaElement | null>(null);
  const backdropRef = useRef<HTMLDivElement | null>(null);
  const [text, setText] = useState<string>(
    (rest.defaultValue as string) ?? (rest.value as string) ?? "",
  );

  const setRefs = useCallback(
    (el: HTMLTextAreaElement | null) => {
      areaRef.current = el;
      if (typeof ref === "function") ref(el);
      else if (ref) ref.current = el;
    },
    [ref],
  );

  // Copy the textarea's own metrics onto the backdrop, and keep the two the
  // same size as the user drags the resize handle.
  useLayoutEffect(() => {
    const area = areaRef.current;
    const backdrop = backdropRef.current;
    if (!area || !backdrop) return;

    // Set as inline styles, not via CSS or Mantine's `styles` prop: the
    // textarea being see-through is what makes the technique work at all, and
    // a stylesheet rule can lose a specificity race to theme rules that set a
    // background (html[data-mantine-color-scheme="dark"] ... textarea does).
    area.style.backgroundColor = "transparent";
    area.style.position = "relative";
    area.style.zIndex = "1";

    const mirror = () => {
      const cs = window.getComputedStyle(area);
      MIRRORED_PROPS.forEach((p) => {
        backdrop.style[p as any] = cs[p as any];
      });
      backdrop.style.width = `${area.offsetWidth}px`;
      backdrop.style.height = `${area.offsetHeight}px`;
    };

    mirror();
    const ro = new ResizeObserver(mirror);
    ro.observe(area);
    return () => ro.disconnect();
  }, []);

  // Keep the backdrop scrolled with the text.
  const syncScroll = useCallback(() => {
    const area = areaRef.current;
    const backdrop = backdropRef.current;
    if (!area || !backdrop) return;
    backdrop.scrollTop = area.scrollTop;
    backdrop.scrollLeft = area.scrollLeft;
  }, []);

  // Typing. A native listener also catches programmatic input events.
  useEffect(() => {
    const area = areaRef.current;
    if (!area) return;
    const onInput = () => {
      setText(area.value);
      syncScroll();
    };
    area.addEventListener("input", onInput);
    return () => area.removeEventListener("input", onInput);
  }, [syncScroll]);

  // The value can also be assigned straight to the DOM node (prompt variants).
  useEffect(() => {
    if (areaRef.current) setText(areaRef.current.value);
  }, [syncKey]);

  const segments = useMemo(() => splitTemplateVars(text), [text]);

  /* Drawn from the same palette as the handle badges below the textarea --
     the indigo/orange split follows the same settings-variable rule as
     genTemplateHooks in TemplateHooksComponent -- but one step stronger than
     Badge's light variant, which uses shade 0 (light) and shade 9 at 20%
     (dark). A badge carries coloured text and padding to read its tint from;
     this sits behind ordinary body-coloured text at glyph height, so the
     identical colour reads weaker in place, noticeably so on dark. Only the
     shade index is ours: the hues still follow the theme. */
  const varBackground = useCallback(
    (name?: string) => {
      const shades =
        theme.colors[name?.charAt(0) === "=" ? "orange" : "indigo"];
      return theme.colorScheme === "dark"
        ? theme.fn.rgba(shades[9], 0.45)
        : shades[1];
    },
    [theme],
  );

  return (
    <div className="tpl-highlight-wrap">
      <div className="tpl-highlight-backdrop" ref={backdropRef} aria-hidden>
        {segments.map((seg, i) =>
          seg.isVar ? (
            <mark
              className="tpl-highlight-var"
              key={i}
              style={{ backgroundColor: varBackground(seg.name) }}
            >
              {seg.text}
            </mark>
          ) : (
            <span key={i}>{seg.text}</span>
          ),
        )}
        {/* A trailing newline is not rendered by the browser, so the backdrop
            would be one line short of the textarea while scrolled to the end. */}
        {text.endsWith("\n") ? "\n " : null}
      </div>
      <Textarea
        {...rest}
        ref={setRefs}
        className={`tpl-highlight-input ${className ?? ""}`}
        onChange={onChange}
        onScroll={syncScroll}
        styles={styles}
      />
    </div>
  );
});

export default TemplateHighlightTextarea;
