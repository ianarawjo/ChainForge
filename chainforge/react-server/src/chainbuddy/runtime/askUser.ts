/**
 * ask_user: ChainBuddy asks the user a question with a few options to pick
 * from, before it builds something that could go several ways. The chat panel
 * shows the options as cards; the user picks one or writes their own answer,
 * which comes back as their next message. Asking ends ChainBuddy's turn.
 */

import { AgentTool, isPlainObject } from "./tools";

export interface QuestionOption {
  /** A few words naming the option. */
  title: string;
  /** One short sentence on what it would mean. */
  detail: string;
}

export interface Question {
  question: string;
  options: QuestionOption[];
}

const MIN_OPTIONS = 2;
const MAX_OPTIONS = 4;

export function createAskUserTool(
  show: (question: Question) => void,
): AgentTool {
  return {
    name: "ask_user",
    description:
      "Asks the user to choose how to go on, offering a few distinct options they can click, or they can answer in their own words. Ends your turn; their answer is their next message.",
    parameters: {
      type: "object",
      required: ["question", "options"],
      properties: {
        question: {
          type: "string",
          description: "The question, in one short sentence.",
        },
        options: {
          type: "array",
          description: `${MIN_OPTIONS} to ${MAX_OPTIONS} distinct options, usually 3.`,
          items: {
            type: "object",
            required: ["title", "detail"],
            properties: {
              title: {
                type: "string",
                description: "A few words naming the option.",
              },
              detail: {
                type: "string",
                description: "One short sentence on what it would mean.",
              },
            },
          },
        },
      },
    },
    endsTurn: true,
    run: (args) => {
      const options = (args.options as unknown[]).filter(isPlainObject);
      if (options.length < MIN_OPTIONS || options.length > MAX_OPTIONS)
        throw new Error(
          `Give ${MIN_OPTIONS} to ${MAX_OPTIONS} options; you gave ${options.length}.`,
        );
      show({
        question: String(args.question).trim(),
        options: options.map((o) => ({
          title: String(o.title).trim(),
          detail: String(o.detail).trim(),
        })),
      });
      return "Shown to the user. Stop here: their answer will be their next message.";
    },
  };
}
