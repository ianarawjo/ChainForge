/*
 * @jest-environment jsdom
 */

// The Pyodide loader uses import.meta, which CRA's CommonJS Jest cannot parse.
jest.mock("../pyodide/exec-py", () => ({ execPy: jest.fn() }));
// The store and ModelSettingSchemas import each other (see backend.test.ts).
jest.mock("../../store", () => ({
  __esModule: true,
  default: {
    getState: () => ({ AvailableLLMs: [], setAvailableLLMs: jest.fn() }),
  },
}));
// Rating buttons aren't under test, and pull in the whole app state.
jest.mock("../../ResponseRatingToolbar", () => ({
  __esModule: true,
  default: () => null,
}));

// eslint-disable-next-line import/first
import React from "react";
// eslint-disable-next-line import/first
import { fireEvent, render, screen } from "@testing-library/react";
// eslint-disable-next-line import/first
import { describe, expect, test } from "@jest/globals";
// eslint-disable-next-line import/first
import { TableResponseCell } from "../../TableResponseCell";
// eslint-disable-next-line import/first
import { LLMResponse } from "../typing";

const responseObj = (
  responses: string[],
  reasoning?: (string | null)[],
): LLMResponse => ({
  uid: "uid-1",
  prompt: "Q",
  vars: {},
  metavars: {},
  llm: "Model",
  responses,
  ...(reasoning && { reasoning }),
});

const reasoningButtons = () =>
  screen.queryAllByRole("button", { name: /Reasoning/ });

describe("reasoning in response cards", () => {
  test("a chip expands and collapses a response's reasoning, without opening the response", () => {
    const onOpen = jest.fn();
    render(
      <TableResponseCell
        responses={[responseObj(["The answer"], ["Let me think."])]}
        lines={6}
        onOpen={onOpen}
      />,
    );

    const [chip] = reasoningButtons();
    expect(chip.getAttribute("aria-expanded")).toBe("false");
    expect(screen.queryByText("Let me think.")).toBeNull();

    fireEvent.click(chip);
    expect(chip.getAttribute("aria-expanded")).toBe("true");
    expect(screen.queryByText("Let me think.")).not.toBeNull();
    expect(onOpen).not.toHaveBeenCalled();

    fireEvent.click(chip);
    expect(screen.queryByText("Let me think.")).toBeNull();
  });

  test("only responses with reasoning get a chip", () => {
    render(
      <TableResponseCell
        responses={[
          responseObj(["With", "Without"], ["Some thoughts", null]),
          { ...responseObj(["No reasoning at all"]), uid: "uid-2" },
        ]}
        lines={6}
      />,
    );
    expect(reasoningButtons()).toHaveLength(1);
  });

  test("identical responses that reasoned differently say so", () => {
    render(
      <TableResponseCell
        responses={[
          responseObj(["Same", "Same"], ["First route", "Second route"]),
        ]}
        lines={6}
      />,
    );
    fireEvent.click(reasoningButtons()[0]);
    expect(screen.queryByText("First route", { exact: false })).not.toBeNull();
    expect(
      screen.queryByText(/the others reasoned differently/),
    ).not.toBeNull();
  });

  test("no chip when only scores are shown", () => {
    render(
      <TableResponseCell
        responses={[responseObj(["The answer"], ["Let me think."])]}
        lines={6}
        onlyShowScores
      />,
    );
    expect(reasoningButtons()).toHaveLength(0);
  });
});
