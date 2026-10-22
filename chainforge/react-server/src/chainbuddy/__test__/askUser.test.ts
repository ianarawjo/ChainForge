import { expect, test } from "@jest/globals";
import { createAskUserTool, Question } from "../runtime/askUser";

test("ask_user shows a question with its options, and ends the turn", () => {
  const shown: Question[] = [];
  const tool = createAskUserTool((q) => shown.push(q));
  expect(tool.endsTurn).toBe(true);
  tool.run(
    {
      question: " How should bias be measured? ",
      options: [
        { title: "Pronouns", detail: "Count pronouns used for occupations." },
        { title: "Swapped pairs", detail: "Swap genders and compare." },
      ],
    },
    {},
  );
  expect(shown).toEqual([
    {
      question: "How should bias be measured?",
      options: [
        { title: "Pronouns", detail: "Count pronouns used for occupations." },
        { title: "Swapped pairs", detail: "Swap genders and compare." },
      ],
    },
  ]);
});

test("ask_user needs two to four options", () => {
  const tool = createAskUserTool(() => undefined);
  const option = { title: "A", detail: "a" };
  expect(() => tool.run({ question: "Q?", options: [option] }, {})).toThrow(
    "Give 2 to 4 options; you gave 1.",
  );
  expect(() =>
    tool.run({ question: "Q?", options: Array(5).fill(option) }, {}),
  ).toThrow("you gave 5");
});
