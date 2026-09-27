import doc from "../knowledge/nodes/inspect.md";
import { oneOf, titleSetting } from "./common";
import { NodeKind } from "./types";

/** ChainBuddy's name for a view → the node's own (LLMResponseInspector). */
const VIEWS: Record<string, string> = {
  grouped: "hierarchy",
  table: "table",
  grid: "grid",
};
const VIEW_NAMES = Object.fromEntries(
  Object.entries(VIEWS).map(([name, format]) => [format, name]),
);

export const inspectKind: NodeKind = {
  type: "inspect",
  name: "Inspect Node",
  doc,
  accepts: ["responses", "scored_responses"],
  handles: { inputs: { responses: "input" } },
  unconnectedHint: "Connect the responses it should show to it.",

  settings: {
    title: titleSetting,
    view: {
      label: "View",
      check: oneOf("view", Object.keys(VIEWS)),
    },
  },

  inputs: () => ["responses"],

  read(data) {
    const view = VIEW_NAMES[data.viewFormat];
    return {
      title: data.title ?? inspectKind.name,
      ...(view ? { view } : {}),
    };
  },

  write(settings, base) {
    const out = { ...(base ?? {}) };
    if (typeof settings.title === "string") out.title = settings.title;
    if (typeof settings.view === "string" && VIEWS[settings.view])
      out.viewFormat = VIEWS[settings.view];
    return out;
  },
};
