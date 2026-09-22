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
const MODELS: ModelInfo[] = [
  ["openrouter/anthropic/claude-haiku-4.5", "Claude Haiku 4.5"],
  ["openrouter/openai/gpt-5.4-mini", "GPT-5.4 Mini"],
  ["openrouter/google/gemini-3.1-flash-lite", "Gemini 3.1 Flash-Lite"],
].map(([id, name]) => ({ id, name, provider: "OpenRouter", ready: true }));
const OLLAMA_MODELS: ModelInfo[] = ["qwen3.5:4b", "gemma4:e4b"].map((name) => ({
  id: `ollama/${name}`,
  name,
  provider: "Ollama",
  ready: true,
}));

const SCENARIOS: { name: string; flow: FlowView; request: string }[] = [
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
    async ({ flow, request }) => {
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
      const { tools, proposals } = createStubTools({
        flow,
        models: [...MODELS, ...(provider === "ollama" ? OLLAMA_MODELS : [])],
        nodeDocs: nodeDocs(),
      });

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

      const started = Date.now();
      const result = await runAgent({
        client,
        system: systemPrompt(INSTRUCTIONS),
        messages: [{ role: "user", content: request }],
        tools,
        maxSteps: 12,
        onEvent,
      });
      flushText();

      log.push(
        `STOP: ${result.stopReason}${result.error ? ` (${result.error})` : ""}; ` +
          `${result.usage.inputTokens} in / ${result.usage.outputTokens} out; ` +
          `${((Date.now() - started) / 1000).toFixed(1)}s; ${proposals.length} valid proposal(s)`,
      );
      // eslint-disable-next-line no-console
      console.log(log.join("\n"));

      expect(result.stopReason).toBe("done");
      expect(proposals.length).toBeGreaterThan(0);
    },
    15 * 60 * 1000,
  );
});
