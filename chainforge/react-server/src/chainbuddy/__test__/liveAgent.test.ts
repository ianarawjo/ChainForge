/**
 * @jest-environment ./src/chainbuddy/__test__/liveEnvironment.js
 */

// PROTOTYPE: runs ChainBuddy's agent loop against a real model, with stub
// tools, and prints what happened. Skipped unless CHAINBUDDY_LIVE is set:
//
//   CHAINBUDDY_LIVE=ollama:qwen3.5:4b npx craco test --watchAll=false liveAgent
//   CHAINBUDDY_LIVE=openrouter:anthropic/claude-haiku-4.5 OPENROUTER_API_KEY=sk-or-... \
//     npx craco test --watchAll=false liveAgent
//
// It checks only that each run ends normally with a valid proposal. Read the
// printed transcript to judge whether the proposal is any good.

import { describe, expect, test } from "@jest/globals";
import * as fs from "fs";
import * as path from "path";
import {
  createOpenAICompatibleClient,
  OpenAICompatibleProvider,
} from "../model/openaiCompatible";
import { AgentEvent, runAgent } from "../runtime/agentLoop";
import { createReviewer } from "../runtime/reviewer";
import { createAskUserTool, Question } from "../runtime/askUser";
import { AgentMessage } from "../model/types";
import { FlowView, ModelInfo } from "../flowApi/types";
import { systemPrompt } from "../nodes";
import {
  BLANK_FLOW,
  createStubTools,
  EXAMPLE_FLOW,
} from "../prototype/stubTools";

const LIVE = process.env.CHAINBUDDY_LIVE ?? "";
const separator = LIVE.indexOf(":");
const provider = LIVE.slice(0, separator) as OpenAICompatibleProvider;
const model = LIVE.slice(separator + 1);

const FLOW_MODELS: Record<string, string> = {
  ollama: "qwen3.5:4b and gemma4:e4b",
  openrouter: "Claude Haiku 4.5 and GPT-5.4 Mini",
};

// What list_models offers, as the app would with an OpenRouter key and Ollama.
// As the real menu has them: OpenRouter's models, and the in-browser default,
// which list_models names apart when anything else is set up.
const MODELS: ModelInfo[] = [
  ...[
    ["openrouter/anthropic/claude-haiku-4.5", "Claude Haiku 4.5"],
    ["openrouter/openai/gpt-5.4-mini", "GPT-5.4 Mini"],
    ["openrouter/google/gemini-3.1-flash-lite", "Gemini 3.1 Flash-Lite"],
    ["openrouter/qwen/qwen3.8-flash", "Qwen3.8 Flash"],
  ].map(([id, name]) => ({ id, name, provider: "OpenRouter", ready: true })),
  {
    id: "Qwen2.5-0.5B-Instruct-q4f16_1-MLC",
    name: "Qwen2.5 0.5B",
    provider: "In-browser LLMs",
    ready: true,
    fallback: true,
  },
  {
    id: "openrouter/~typesafe/jev-latest",
    name: "Jev",
    provider: "OpenRouter",
    ready: true,
    judgeOnly: true,
    defaultJudge: true,
  },
];
const OLLAMA_MODELS: ModelInfo[] = ["qwen3.5:4b", "gemma4:e4b"].map((name) => ({
  id: `ollama/${name}`,
  name,
  provider: "Ollama",
  ready: true,
}));

const SCENARIOS: {
  name: string;
  flow: FlowView;
  request: string;
  /** Node types the last valid proposal must add. */
  adds?: string[];
  /** The user's answer if asked a question, in their own words; else the first option. */
  answer?: string;
}[] = [
  {
    name: "create a flow on an empty canvas",
    flow: { nodes: [], connections: [] },
    request: `I want to compare how two models summarize three short science facts in one sentence each, and check that every summary really is one sentence. Use the models ${FLOW_MODELS[provider]}. Make up the three facts.`,
  },
  {
    name: "fill in the blank flow New Flow creates",
    flow: BLANK_FLOW,
    request: `Check whether ${FLOW_MODELS[provider]} answer three trivia questions correctly. Make up the questions.`,
  },
  {
    name: "an audit plots its scores",
    flow: BLANK_FLOW,
    request:
      "I want to audit a small Qwen model for gender biases in its short " +
      "responses. Can you make a flow that helps me do that",
    answer: "Have a model judge each response for gender stereotypes.",
    adds: ["llmeval", "vis"],
  },
  {
    name: "a judgment needs an LLM Scorer",
    flow: EXAMPLE_FLOW,
    request:
      "Are these summaries friendly and easy to read? Score them and show me " +
      "the results.",
    adds: ["llmeval", "vis"],
  },
  {
    name: "check answers against expected answers",
    flow: BLANK_FLOW,
    request:
      "I want to see how often the model gets simple arithmetic right. " +
      "Use five questions, each with its correct answer.",
  },
  {
    name: "plot a run measure, which needs no evaluator",
    flow: EXAMPLE_FLOW,
    request:
      "How fast is this model answering? Show me, and let me read the " +
      "answers too.",
  },
  {
    name: "edit the example flow",
    flow: EXAMPLE_FLOW,
    request:
      "Add a second wording of the prompt that asks for a summary a ten-year-old would understand, so I can compare the two wordings.",
  },
];

const KNOWLEDGE = path.join(__dirname, "..", "knowledge");
const INSTRUCTIONS = fs.readFileSync(
  path.join(KNOWLEDGE, "instructions.md"),
  "utf8",
);

function nodeDocs(): Record<string, string> {
  const dir = path.join(KNOWLEDGE, "nodes");
  const docs: Record<string, string> = {};
  for (const file of fs.readdirSync(dir))
    docs[path.basename(file, ".md")] = fs.readFileSync(
      path.join(dir, file),
      "utf8",
    );
  return docs;
}

function clip(text: string, max = 600) {
  return text.length > max
    ? `${text.slice(0, max)}… (${text.length} chars)`
    : text;
}

(LIVE ? describe : describe.skip)(`live agent: ${LIVE}`, () => {
  test.each(SCENARIOS)(
    "$name",
    async ({ flow, request, adds, answer: typed }) => {
      if (!["ollama", "openrouter"].includes(provider))
        throw new Error(
          'CHAINBUDDY_LIVE must look like "ollama:<model>" or "openrouter:<model>".',
        );

      const client = createOpenAICompatibleClient({
        provider,
        model,
        apiKey: process.env.OPENROUTER_API_KEY,
        reasoningEffort: provider === "openrouter" ? "low" : undefined,
      });
      const { tools, proposals, reviews, startTurn } = createStubTools({
        flow,
        models: [...MODELS, ...(provider === "ollama" ? OLLAMA_MODELS : [])],
        nodeDocs: nodeDocs(),
        // The same model takes a second look at each proposal, as in the app.
        review: createReviewer(
          client,
          fs.readFileSync(path.join(KNOWLEDGE, "review.md"), "utf8"),
        ),
      });
      startTurn(request);

      const log: string[] = [`USER: ${request}`];
      let text = "";
      let reasoningChars = 0;
      const flushText = () => {
        if (reasoningChars > 0)
          log.push(`  (reasoned: ${reasoningChars} chars)`);
        if (text.trim()) log.push(`ASSISTANT: ${text.trim()}`);
        text = "";
        reasoningChars = 0;
      };
      const onEvent = (e: AgentEvent) => {
        if (e.type === "text") text += e.delta;
        else if (e.type === "reasoning") reasoningChars += e.delta.length;
        else if (e.type === "step_finish") {
          flushText();
          log.push(
            `  -- step ${e.step}: ${e.finishReason}, ${e.usage?.inputTokens ?? "?"} in / ${e.usage?.outputTokens ?? "?"} out`,
          );
        } else if (e.type === "tool_call")
          log.push(`CALL ${e.call.name}: ${clip(e.call.arguments, 3000)}`);
        else if (e.type === "tool_result")
          log.push(
            `${e.ok ? "RESULT" : "ERROR "} ${e.name}: ${clip(e.content, e.ok ? 300 : 1500)}`,
          );
      };

      // A question is answered with its first option, as if clicked.
      const asked: Question[] = [];
      const askUser = createAskUserTool((q) => {
        asked.push(q);
        log.push(
          `ASKED: ${q.question}\n${q.options.map((o, i) => `  ${i + 1}. ${o.title}: ${o.detail}`).join("\n")}`,
        );
      });
      const started = Date.now();
      const messages: AgentMessage[] = [{ role: "user", content: request }];
      let result = await runAgent({
        client,
        system: systemPrompt(INSTRUCTIONS),
        messages,
        tools: [...tools, askUser],
        maxSteps: 12,
        onEvent,
      });
      if (asked.length > 0 && proposals.length === 0) {
        flushText();
        const pick = asked[asked.length - 1].options[0];
        const answer = typed ?? `${pick.title}: ${pick.detail}`;
        log.push(
          `USER (${typed ? "answers" : "clicks the first option"}): ${answer}`,
        );
        messages.push(...result.messages, { role: "user", content: answer });
        startTurn(`${request}\n\n${answer}`);
        result = await runAgent({
          client,
          system: systemPrompt(INSTRUCTIONS),
          messages,
          tools: [...tools, askUser],
          maxSteps: 12,
          onEvent,
        });
      }
      flushText();

      for (const r of reviews)
        if (r)
          log.push(
            `REVIEW: fixed ${JSON.stringify(r.fixed)}; unresolved ${JSON.stringify(r.unresolved)}${r.failed ? "; FAILED" : ""}`,
          );
      log.push(
        `STOP: ${result.stopReason}${result.error ? ` (${result.error})` : ""}; ` +
          `${result.usage.inputTokens} in / ${result.usage.outputTokens} out; ` +
          `${((Date.now() - started) / 1000).toFixed(1)}s; ${proposals.length} valid proposal(s)`,
      );
      // eslint-disable-next-line no-console
      console.log(log.join("\n"));

      expect(result.stopReason).toBe("done");
      expect(proposals.length).toBeGreaterThan(0);
      const added = proposals[proposals.length - 1].changes.flatMap((c) =>
        c.op === "add_node" ? [c.type] : [],
      );
      for (const type of adds ?? []) expect(added).toContain(type);
    },
    15 * 60 * 1000,
  );
});
