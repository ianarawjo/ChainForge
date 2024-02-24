import {
  StringTemplate,
  PromptTemplate,
  PromptPermutationGenerator,
  escapeBraces,
} from "../template";
import { expect, test } from "@jest/globals";

test("string template", () => {
  // Test regular string template
  const st = new StringTemplate("{pronoun} favorite {thing} is...");
  expect(st.has_vars()).toBe(true);
  expect(st.has_vars(["thing"])).toBe(true);
  expect(st.has_vars(["pronoun"])).toBe(true);
  expect(st.has_vars(["tacos"])).toBe(false);
  expect(st.safe_substitute({ thing: "food" })).toBe(
    "{pronoun} favorite food is...",
  );
  expect(st.safe_substitute({ pronoun: "My" })).toBe(
    "My favorite {thing} is...",
  );
  expect(st.safe_substitute({ pronoun: "My", thing: "food" })).toBe(
    "My favorite food is...",
  );
  expect(st.safe_substitute({ meat: "chorizo" })).toBe(
    "{pronoun} favorite {thing} is...",
  );
  expect(
    new StringTemplate(
      st.safe_substitute({ thing: "programming language" }),
    ).has_vars(),
  ).toBe(true);
});

test("string template escaped group", () => {
  const st = new StringTemplate("{pronoun} favorite \\{thing\\} is...");
  expect(st.has_vars(["thing"])).toBe(false);
  expect(st.has_vars(["pronoun"])).toBe(true);
  expect(st.safe_substitute({ thing: "food" })).toBe(
    "{pronoun} favorite \\{thing\\} is...",
  ); // no substitution
  expect(st.safe_substitute({ pronoun: "Our" })).toBe(
    "Our favorite \\{thing\\} is...",
  );
});

test("single template", () => {
  const prompt_gen = new PromptPermutationGenerator(
    "What is the {timeframe} when {person} was born?",
  );
  const vars: { [key: string]: any } = {
    timeframe: ["year", "decade", "century"],
    person: ["Howard Hughes", "Toni Morrison", "Otis Redding"],
  };
  let num_prompts = 0;
  for (const prompt of prompt_gen.generate(vars)) {
    // console.log(prompt.toString());
    expect(prompt.fill_history).toHaveProperty("timeframe");
    expect(prompt.fill_history).toHaveProperty("person");
    num_prompts += 1;
  }
  expect(num_prompts).toBe(9);
});

test("nested templates", () => {
  const prompt_gen = new PromptPermutationGenerator("{prefix}... {suffix}");
  const vars = {
    prefix: [
      "Who invented {tool}?",
      "When was {tool} invented?",
      "What can you do with {tool}?",
    ],
    suffix: [
      "Phrase your answer in the form of a {response_type}",
      "Respond with a {response_type}",
    ],
    tool: ["the flashlight", "CRISPR", "rubber"],
    response_type: ["question", "poem", "nightmare"],
  };
  let num_prompts = 0;
  for (const prompt of prompt_gen.generate(vars)) {
    // console.log(prompt.toString());
    expect(prompt.fill_history).toHaveProperty("prefix");
    expect(prompt.fill_history).toHaveProperty("suffix");
    expect(prompt.fill_history).toHaveProperty("tool");
    expect(prompt.fill_history).toHaveProperty("response_type");
    num_prompts += 1;
  }
  expect(num_prompts).toBe(3 * 3 * (2 * 3));
});

test("carry together vars", () => {
  // # 'Carry together' vars with 'metavar' data attached
  //    NOTE: This feature may be used when passing rows of a table, so that vars that have associated values,
  //          like 'inventor' with 'tool', 'carry together' when being filled into the prompt template.
  //          In addition, 'metavars' may be attached which are, commonly, the values of other columns for that row, but
  //          columns which weren't used to fill in the prompt template explcitly.
  const prompt_gen = new PromptPermutationGenerator(
    "What {timeframe} did {inventor} invent the {tool}?",
  );
  const vars = {
    inventor: [
      {
        text: "Thomas Edison",
        fill_history: {},
        associate_id: "A",
        metavars: { year: 1879 },
      },
      {
        text: "Alexander Fleming",
        fill_history: {},
        associate_id: "B",
        metavars: { year: 1928 },
      },
      {
        text: "William Shockley",
        fill_history: {},
        associate_id: "C",
        metavars: { year: 1947 },
      },
    ],
    tool: [
      { text: "lightbulb", fill_history: {}, associate_id: "A" },
      { text: "penicillin", fill_history: {}, associate_id: "B" },
      { text: "transistor", fill_history: {}, associate_id: "C" },
    ],
    timeframe: ["year", "decade", "century"],
  };
  let num_prompts = 0;
  for (const prompt of prompt_gen.generate(vars)) {
    const prompt_str = prompt.toString();
    // console.log(prompt_str, prompt.metavars)
    expect(prompt.metavars).toHaveProperty("year");
    if (prompt_str.includes("Edison"))
      expect(prompt_str.includes("lightbulb")).toBe(true);
    else if (prompt_str.includes("Fleming"))
      expect(prompt_str.includes("penicillin")).toBe(true);
    else if (prompt_str.includes("Shockley"))
      expect(prompt_str.includes("transistor")).toBe(true);
    num_prompts += 1;
  }
  expect(num_prompts).toBe(3 * 3);
});

test("escaped braces", () => {
  // Escaped braces \{ and \} should not be treated as real variables, one, and two, should be
  // removed when calling the 'toString' method on a PromptTemplate:
  const promptTemplate = new PromptTemplate(
    "For what show did \\{person\\} get a Netflix deal?",
  );
  const filledTemplate = promptTemplate.fill({ person: "Meghan Markle" });
  expect(promptTemplate.toString()).toBe(
    "For what show did {person} get a Netflix deal?",
  );
  expect(promptTemplate.toString()).toEqual(filledTemplate.toString());
  expect(escapeBraces("Why is the set {0, 1, 2} of size 3?")).toEqual(
    "Why is the set \\{0, 1, 2\\} of size 3?",
  );
});
