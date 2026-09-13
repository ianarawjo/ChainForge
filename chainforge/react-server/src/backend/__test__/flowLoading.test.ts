import { describe, expect, test } from "@jest/globals";
import { FlowLoadSource, flowLoadReplacesMedia } from "../flowLoading";

describe("which flow loads clear stored media", () => {
  // Each replaces the current flow and brings its own media (or none), so the
  // previous flow's files would otherwise linger against the storage budget.
  const clearing: FlowLoadSource[] = [
    "file",
    "example",
    "openai-eval",
    "saved-flow",
    "starter",
  ];
  test.each(clearing)("%s clears", (source) => {
    expect(flowLoadReplacesMedia(source)).toBe(true);
  });

  // A bundle's media are imported before its flow loads, and the autosave is
  // the current flow: clearing on either would delete files the flow uses.
  // A shared link can be opened by accident, so it never deletes anything.
  const keeping: FlowLoadSource[] = ["bundle", "autosave", "shared-link"];
  test.each(keeping)("%s keeps media", (source) => {
    expect(flowLoadReplacesMedia(source)).toBe(false);
  });

  test("an unknown source is refused rather than guessed", () => {
    expect(() => flowLoadReplacesMedia("mystery" as FlowLoadSource)).toThrow(
      /Unknown flow load source/,
    );
  });
});
