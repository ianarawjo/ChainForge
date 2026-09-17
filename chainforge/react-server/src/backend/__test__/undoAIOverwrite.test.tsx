/*
 * @jest-environment jsdom
 */
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test } from "@jest/globals";
import useUndoAIOverwrite from "../../useUndoAIOverwrite";

/** A node's content, with the hook over it, as a node and its AI popover use it. */
function setup(initial: string[]) {
  let content = initial;
  const restore = jest.fn((before: string[]) => {
    content = before;
  });
  const hook = renderHook(
    ({ current }) => useUndoAIOverwrite(current, restore),
    { initialProps: { current: content } },
  );
  const setContent = (next: string[]) => {
    content = next;
    hook.rerender({ current: content });
  };
  /** An AI change, as a popover applies it: remember, then overwrite. */
  const aiOverwrite = (next: string[]) =>
    act(() => {
      hook.result.current.remember();
      setContent(next);
    });
  return { hook, restore, setContent, aiOverwrite, get: () => content };
}

beforeEach(() => {
  jest.useFakeTimers();
});
afterEach(() => {
  jest.useRealTimers();
});

describe("undoing an AI change that overwrote something", () => {
  test("puts back what was there, once", () => {
    const { hook, restore, aiOverwrite, get } = setup(["mine", "also mine"]);
    expect(hook.result.current.canUndo).toBe(false);

    aiOverwrite(["from AI"]);
    expect(hook.result.current.canUndo).toBe(true);

    act(() => hook.result.current.undo());
    expect(restore).toHaveBeenCalledWith(["mine", "also mine"]);
    expect(get()).toEqual(["mine", "also mine"]);
    expect(hook.result.current.canUndo).toBe(false);
  });

  test("stays available while the AI's content is untouched", () => {
    const { hook, aiOverwrite, setContent } = setup(["mine"]);
    aiOverwrite(["from AI"]);
    act(() => jest.advanceTimersByTime(60_000));
    // Re-rendering with equal content isn't an edit
    act(() => setContent(["from AI"]));
    expect(hook.result.current.canUndo).toBe(true);
  });

  test("isn't offered once the AI's content has been edited, so edits aren't lost", () => {
    const { hook, restore, aiOverwrite, setContent } = setup(["mine"]);
    aiOverwrite(["from AI"]);
    act(() => jest.advanceTimersByTime(5000));
    act(() => setContent(["from AI, edited"]));
    expect(hook.result.current.canUndo).toBe(false);
    act(() => hook.result.current.undo());
    expect(restore).not.toHaveBeenCalled();
  });

  test("follows an AI change that arrives in steps, e.g. after a debounce", () => {
    const { hook, restore, aiOverwrite, setContent } = setup(["mine"]);
    aiOverwrite(["from AI"]);
    act(() => jest.advanceTimersByTime(300));
    act(() => setContent(["from AI", ""])); // e.g. a node normalizing it
    expect(hook.result.current.canUndo).toBe(true);
    act(() => hook.result.current.undo());
    expect(restore).toHaveBeenCalledWith(["mine"]);
  });

  test("offers nothing when the AI wrote exactly what was there", () => {
    const { hook, aiOverwrite } = setup(["same"]);
    aiOverwrite(["same"]);
    act(() => jest.advanceTimersByTime(2000));
    expect(hook.result.current.canUndo).toBe(false);
  });
});
