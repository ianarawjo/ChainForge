import React, {
  CSSProperties,
  forwardRef,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Textarea, TextareaProps, useMantineTheme } from "@mantine/core";
import { extractTemplateVarSpans } from "./backend/template";

export interface TemplateSegment {
  text: string;
  isVar: boolean;
  /** The name inside the braces, for variable segments. */
  name?: string;
}

/**
 * Splits a prompt template into plain and {variable} segments for rendering.
 *
 * The scanning itself belongs to extractTemplateVarSpans in backend/template.ts
 * and is not repeated here: what gets highlighted has to be exactly what the
 * engine will substitute, and a second copy of those rules would eventually
 * disagree with the first. This only turns the spans into runs of text.
 */
export function splitTemplateVars(template: string): TemplateSegment[] {
  const segments: TemplateSegment[] = [];
  let cursor = 0;

  for (const { start, end, name } of extractTemplateVarSpans(template)) {
    if (start > cursor)
      segments.push({ text: template.substring(cursor, start), isVar: false });
    segments.push({
      text: template.substring(start, end + 1),
      isVar: true,
      name,
    });
    cursor = end + 1;
  }

  if (cursor < template.length)
    segments.push({ text: template.substring(cursor), isVar: false });

  return segments;
}

/**
 * Assigning `.value` to a textarea does not fire an `input` event, so a
 * highlighted textarea written to from outside React would keep showing the
 * previous text's highlights. Use this instead of `el.value = ...`.
 *
 * A private event rather than a synthetic `input`: an `input` event would also
 * run React's onChange, and in PromptNode that marks the node's results stale,
 * which merely switching prompt variants should not do.
 */
export const TEMPLATE_TEXTAREA_SYNC_EVENT = "chainforge:template-textarea-sync";

export function setTemplateTextareaValue(
  el: HTMLTextAreaElement | HTMLDivElement | null | undefined,
  value: string,
) {
  if (!el || !("value" in el)) return;
  (el as HTMLTextAreaElement).value = value;
  el.dispatchEvent(new Event(TEMPLATE_TEXTAREA_SYNC_EVENT));
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

export type TemplateHighlightTextareaProps = TextareaProps;

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
  const { className, onChange, styles, ...rest } = props;
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

  // Typing, plus any write announced with setTemplateTextareaValue. Reading
  // the value off the event's own target means the backdrop cannot go stale:
  // it does not depend on a prop changing, or on this effect running after
  // whichever effect did the writing.
  useEffect(() => {
    const area = areaRef.current;
    if (!area) return;
    const onInput = () => {
      setText(area.value);
      syncScroll();
    };
    area.addEventListener("input", onInput);
    area.addEventListener(TEMPLATE_TEXTAREA_SYNC_EVENT, onInput);
    return () => {
      area.removeEventListener("input", onInput);
      area.removeEventListener(TEMPLATE_TEXTAREA_SYNC_EVENT, onInput);
    };
  }, [syncScroll]);

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
              /* A custom property, not background-color: the colour depends on
                 the variable so it has to come from here, but leaving the
                 background-color declaration itself in CSS means a surface
                 that needs a different treatment can still override it with an
                 ordinary rule, instead of losing to an inline style. */
              style={
                { "--tpl-var-bg": varBackground(seg.name) } as CSSProperties
              }
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
