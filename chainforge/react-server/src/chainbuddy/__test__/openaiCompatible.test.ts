/**
 * @jest-environment jsdom
 */

// The adapter streams through the openai SDK, which sends through the fetch
// passed to it. Each test answers with a recorded-style event stream and
// checks both what the adapter returns and what it sent.

import { describe, expect, jest, test } from "@jest/globals";
import { createOpenAICompatibleClient } from "../model/openaiCompatible";
import {
  AgentMessage,
  ModelRequestAborted,
  ModelStreamEvent,
} from "../model/types";

/** A server-sent event stream of Chat Completions chunks. */
function sse(chunks: object[]): string {
  return (
    chunks.map((c) => `data: ${JSON.stringify(c)}\n\n`).join("") +
    "data: [DONE]\n\n"
  );
}

function chunk(delta: object, finish_reason: string | null = null) {
  return { choices: [{ index: 0, delta, finish_reason }] };
}

/** A fetch that answers each call with the next stream, and records requests. */
function fakeFetch(...streams: string[]) {
  const requests: { url: string; headers: Headers; body: any }[] = [];
  const fn = jest.fn(async (url: any, init?: any) => {
    requests.push({
      url: String(url),
      headers: new Headers(init?.headers),
      body: JSON.parse(init?.body ?? "{}"),
    });
    const text = streams.shift();
    if (text === undefined) throw new Error("No more fake responses.");
    // This Jest has no Response or ReadableStream; the SDK reads any async
    // iterable of bytes as a body.
    return {
      ok: true,
      status: 200,
      statusText: "OK",
      headers: new Headers({ "content-type": "text/event-stream" }),
      body: (async function* () {
        yield new TextEncoder().encode(text);
      })(),
    };
  });
  return { fetch: fn as unknown as typeof fetch, requests };
}

const weatherTool = {
  name: "get_weather",
  description: "Get weather for a city",
  parameters: {
    type: "object" as const,
    required: ["city"],
    properties: { city: { type: "string" as const } },
  },
};

describe("Ollama", () => {
  // Shaped like a real qwen3.5:4b stream from Ollama 0.34: reasoning in
  // pieces, then the whole tool call in one chunk, then usage.
  const ollamaStream = sse([
    chunk({ role: "assistant", content: "", reasoning: "The user" }),
    chunk({ content: "", reasoning: " wants weather." }),
    chunk({
      content: "",
      tool_calls: [
        {
          id: "call_etqyhft7",
          index: 0,
          type: "function",
          function: { name: "get_weather", arguments: '{"city":"Paris"}' },
        },
      ],
    }),
    chunk({}, "tool_calls"),
    {
      choices: [],
      usage: { prompt_tokens: 277, completion_tokens: 78, total_tokens: 355 },
    },
  ]);

  test("streams reasoning and a tool call", async () => {
    const { fetch, requests } = fakeFetch(ollamaStream);
    const client = createOpenAICompatibleClient({
      provider: "ollama",
      model: "qwen3.5:4b",
      fetch,
    });
    const events: ModelStreamEvent[] = [];

    const turn = await client.respond(
      {
        system: "Be brief.",
        messages: [{ role: "user", content: "Weather in Paris?" }],
        tools: [weatherTool],
      },
      { onEvent: (e) => events.push(e) },
    );

    expect(turn).toEqual({
      message: {
        role: "assistant",
        content: "",
        toolCalls: [
          {
            id: "call_etqyhft7",
            name: "get_weather",
            arguments: '{"city":"Paris"}',
          },
        ],
        reasoning: {
          provider: "ollama",
          text: "The user wants weather.",
          data: undefined,
        },
      },
      finishReason: "tool_calls",
      usage: { inputTokens: 277, outputTokens: 78 },
    });
    expect(events).toEqual([
      { type: "reasoning", delta: "The user" },
      { type: "reasoning", delta: " wants weather." },
      { type: "tool_call_start", id: "call_etqyhft7", name: "get_weather" },
    ]);

    const [req] = requests;
    expect(req.url).toBe("http://localhost:11434/v1/chat/completions");
    expect(req.body).toMatchObject({
      model: "qwen3.5:4b",
      stream: true,
      stream_options: { include_usage: true },
      max_tokens: 8192,
      messages: [
        { role: "system", content: "Be brief." },
        { role: "user", content: "Weather in Paris?" },
      ],
      tools: [
        {
          type: "function",
          function: {
            name: "get_weather",
            description: "Get weather for a city",
            parameters: weatherTool.parameters,
          },
        },
      ],
    });
    // Ollama doesn't support tool_choice.
    expect(req.body.tool_choice).toBeUndefined();
  });

  test("uses a custom Ollama address", async () => {
    const { fetch, requests } = fakeFetch(
      sse([chunk({ content: "Hi" }, "stop")]),
    );
    const client = createOpenAICompatibleClient({
      provider: "ollama",
      model: "qwen3.5:4b",
      baseURL: "http://gpu-box:11434/v1",
      fetch,
    });
    const turn = await client.respond({
      messages: [{ role: "user", content: "Hi" }],
    });
    expect(requests[0].url).toBe("http://gpu-box:11434/v1/chat/completions");
    expect(turn.message).toEqual({ role: "assistant", content: "Hi" });
    expect(turn.finishReason).toBe("stop");
  });
});

describe("OpenRouter", () => {
  test("joins tool call arguments streamed in pieces, across parallel calls", async () => {
    const { fetch, requests } = fakeFetch(
      sse([
        chunk({ content: "Checking both." }),
        chunk({
          tool_calls: [
            {
              index: 0,
              id: "a",
              function: { name: "get_weather", arguments: "" },
            },
          ],
        }),
        chunk({ tool_calls: [{ index: 0, function: { arguments: '{"ci' } }] }),
        chunk({
          tool_calls: [
            {
              index: 1,
              id: "b",
              function: { name: "get_weather", arguments: '{"city":' },
            },
          ],
        }),
        chunk({
          tool_calls: [{ index: 0, function: { arguments: 'ty":"Paris"}' } }],
        }),
        chunk({
          tool_calls: [{ index: 1, function: { arguments: '"Oslo"}' } }],
        }),
        chunk({}, "tool_calls"),
      ]),
    );
    const client = createOpenAICompatibleClient({
      provider: "openrouter",
      model: "openai/gpt-5.4-mini",
      apiKey: "sk-or-test",
      reasoningEffort: "low",
      fetch,
    });

    const turn = await client.respond({
      messages: [{ role: "user", content: "Paris and Oslo?" }],
      tools: [weatherTool],
    });

    expect(turn.message.content).toBe("Checking both.");
    expect(turn.message.toolCalls).toEqual([
      { id: "a", name: "get_weather", arguments: '{"city":"Paris"}' },
      { id: "b", name: "get_weather", arguments: '{"city":"Oslo"}' },
    ]);
    expect(turn.finishReason).toBe("tool_calls");

    const [req] = requests;
    expect(req.url).toBe("https://openrouter.ai/api/v1/chat/completions");
    expect(req.headers.get("authorization")).toBe("Bearer sk-or-test");
    expect(req.headers.get("http-referer")).toBe("https://chainforge.ai");
    expect(req.body.reasoning).toEqual({ effort: "low" });
  });

  test("keeps reasoning details whole and sends them back unchanged", async () => {
    // OpenRouter sends reasoning twice: as plain text and as details.
    const { fetch, requests } = fakeFetch(
      sse([
        chunk({
          reasoning: "Need ",
          reasoning_details: [
            {
              type: "reasoning.text",
              text: "Need ",
              format: "anthropic-claude-v1",
              index: 0,
            },
          ],
        }),
        chunk({
          reasoning: "weather.",
          reasoning_details: [
            { type: "reasoning.text", text: "weather.", index: 0 },
          ],
        }),
        chunk({
          reasoning_details: [
            { type: "reasoning.text", text: "", signature: "sig123", index: 0 },
          ],
        }),
        chunk({
          tool_calls: [
            {
              index: 0,
              id: "a",
              function: { name: "get_weather", arguments: '{"city":"Paris"}' },
            },
          ],
        }),
        chunk({}, "tool_calls"),
      ]),
      sse([chunk({ content: "Sunny." }, "stop")]),
    );
    const client = createOpenAICompatibleClient({
      provider: "openrouter",
      model: "anthropic/claude-haiku-4.5",
      apiKey: "sk-or-test",
      fetch,
    });
    const events: ModelStreamEvent[] = [];

    const first = await client.respond(
      {
        messages: [{ role: "user", content: "Weather?" }],
        tools: [weatherTool],
      },
      { onEvent: (e) => events.push(e) },
    );
    expect(first.message.reasoning).toEqual({
      provider: "openrouter",
      text: "Need weather.",
      data: [
        {
          type: "reasoning.text",
          text: "Need weather.",
          format: "anthropic-claude-v1",
          signature: "sig123",
          index: 0,
        },
      ],
    });
    // Shown once, not once per field.
    expect(events.filter((e) => e.type === "reasoning")).toHaveLength(2);

    const conversation: AgentMessage[] = [
      { role: "user", content: "Weather?" },
      first.message,
      { role: "tool", toolCallId: "a", content: "Sunny, 22C" },
    ];
    await client.respond({ messages: conversation, tools: [weatherTool] });

    expect(requests[1].body.messages).toEqual([
      { role: "user", content: "Weather?" },
      {
        role: "assistant",
        content: "",
        tool_calls: [
          {
            id: "a",
            type: "function",
            function: { name: "get_weather", arguments: '{"city":"Paris"}' },
          },
        ],
        reasoning_details: first.message.reasoning?.data,
      },
      { role: "tool", tool_call_id: "a", content: "Sunny, 22C" },
    ]);
  });

  test("drops unsigned Claude reasoning, which Claude would reject", async () => {
    const { fetch, requests } = fakeFetch(
      sse([chunk({ content: "ok" }, "stop")]),
    );
    const client = createOpenAICompatibleClient({
      provider: "openrouter",
      model: "anthropic/claude-haiku-4.5",
      apiKey: "sk-or-test",
      fetch,
    });
    await client.respond({
      messages: [
        { role: "user", content: "Hi" },
        {
          role: "assistant",
          content: "Hello",
          reasoning: {
            provider: "openrouter",
            text: "cut off",
            data: [
              {
                type: "reasoning.text",
                text: "cut off",
                format: "anthropic-claude-v1",
              },
              {
                type: "reasoning.encrypted",
                data: "xyz",
                format: "anthropic-claude-v1",
              },
            ],
          },
        },
        { role: "user", content: "Again" },
      ],
    });
    expect(requests[0].body.messages[1]).toEqual({
      role: "assistant",
      content: "Hello",
      reasoning_details: [
        {
          type: "reasoning.encrypted",
          data: "xyz",
          format: "anthropic-claude-v1",
        },
      ],
    });
  });

  test("never sends another provider's reasoning", async () => {
    const { fetch, requests } = fakeFetch(
      sse([chunk({ content: "ok" }, "stop")]),
    );
    const client = createOpenAICompatibleClient({
      provider: "openrouter",
      model: "openai/gpt-5.4-mini",
      apiKey: "sk-or-test",
      fetch,
    });
    await client.respond({
      messages: [
        { role: "user", content: "Hi" },
        {
          role: "assistant",
          content: "Hello",
          reasoning: {
            provider: "ollama",
            text: "thinking",
            data: [{ type: "reasoning.text" }],
          },
        },
        { role: "user", content: "Again" },
      ],
    });
    expect(requests[0].body.messages[1]).toEqual({
      role: "assistant",
      content: "Hello",
    });
  });

  test("reports an error sent partway through the stream", async () => {
    const { fetch } = fakeFetch(
      sse([
        chunk({ content: "Start" }),
        {
          error: { message: "Upstream provider overloaded" },
          choices: [{ index: 0, delta: {}, finish_reason: "error" }],
        },
      ]),
    );
    const client = createOpenAICompatibleClient({
      provider: "openrouter",
      model: "google/gemini-3.1-flash-lite",
      apiKey: "sk-or-test",
      fetch,
    });
    await expect(
      client.respond({ messages: [{ role: "user", content: "Hi" }] }),
    ).rejects.toThrow("Upstream provider overloaded");
  });

  test("says when a response was cut off by the token limit", async () => {
    const { fetch } = fakeFetch(sse([chunk({ content: "Partial" }, "length")]));
    const client = createOpenAICompatibleClient({
      provider: "openrouter",
      model: "qwen/qwen3.5-9b",
      apiKey: "sk-or-test",
      fetch,
    });
    const turn = await client.respond({
      messages: [{ role: "user", content: "Hi" }],
    });
    expect(turn.finishReason).toBe("length");
  });

  test("needs an API key", () => {
    expect(() =>
      createOpenAICompatibleClient({ provider: "openrouter", model: "x" }),
    ).toThrow("OpenRouter needs an API key");
  });
});

test("a cancelled request rejects as cancelled", async () => {
  const controller = new AbortController();
  const fetch = jest.fn(
    (_url: any, init?: any) =>
      new Promise((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () =>
          reject(new DOMException("Aborted", "AbortError")),
        );
      }),
  ) as unknown as typeof globalThis.fetch;
  const client = createOpenAICompatibleClient({
    provider: "ollama",
    model: "qwen3.5:4b",
    fetch,
  });

  const pending = client.respond(
    { messages: [{ role: "user", content: "Hi" }] },
    { signal: controller.signal },
  );
  controller.abort();
  await expect(pending).rejects.toBeInstanceOf(ModelRequestAborted);
});
