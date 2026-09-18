import { describe, expect, test } from "@jest/globals";
import { AgentEvent, runAgent } from "../runtime/agentLoop";
import { AgentTool, schemaProblems } from "../runtime/tools";
import {
  AssistantMessage,
  ModelClient,
  ModelRequest,
  ModelRequestAborted,
  ModelTurn,
} from "../model/types";

/** A model that gives scripted turns, and records what it was asked. */
function scriptedModel(turns: (AssistantMessage | Error)[]) {
  const requests: ModelRequest[] = [];
  const client: ModelClient = {
    async respond(request) {
      requests.push({ ...request, messages: [...request.messages] });
      const next = turns.shift();
      if (!next) throw new Error("The script ran out of turns.");
      if (next instanceof Error) throw next;
      const turn: ModelTurn = {
        message: next,
        finishReason: next.toolCalls ? "tool_calls" : "stop",
        usage: { inputTokens: 10, outputTokens: 5 },
      };
      return turn;
    },
  };
  return { client, requests };
}

const call = (id: string, name: string, args: unknown) => ({
  id,
  name,
  arguments: typeof args === "string" ? args : JSON.stringify(args),
});

const addTool: AgentTool = {
  name: "add",
  description: "Adds two numbers",
  parameters: {
    type: "object",
    required: ["a", "b"],
    properties: { a: { type: "number" }, b: { type: "number" } },
  },
  run: (args) => ({ sum: (args.a as number) + (args.b as number) }),
};

describe("runAgent", () => {
  test("runs the tools a model calls and returns the results to it", async () => {
    const { client, requests } = scriptedModel([
      {
        role: "assistant",
        content: "",
        toolCalls: [call("c1", "add", { a: 2, b: 3 })],
      },
      { role: "assistant", content: "It's 5." },
    ]);
    const events: AgentEvent[] = [];

    const result = await runAgent({
      client,
      system: "Be brief.",
      messages: [{ role: "user", content: "2+3?" }],
      tools: [addTool],
      onEvent: (e) => events.push(e),
    });

    expect(result.stopReason).toBe("done");
    expect(result.usage).toEqual({ inputTokens: 20, outputTokens: 10 });
    expect(result.messages).toEqual([
      {
        role: "assistant",
        content: "",
        toolCalls: [call("c1", "add", { a: 2, b: 3 })],
      },
      { role: "tool", toolCallId: "c1", content: '{\n  "sum": 5\n}' },
      { role: "assistant", content: "It's 5." },
    ]);
    // The second request carries the whole conversation, and the tool specs
    // without their run functions.
    expect(requests[1].messages).toHaveLength(3);
    expect(requests[1].system).toBe("Be brief.");
    expect(requests[0].tools).toEqual([
      {
        name: "add",
        description: "Adds two numbers",
        parameters: addTool.parameters,
      },
    ]);
    expect(events.map((e) => e.type)).toEqual([
      "step_finish",
      "tool_call",
      "tool_result",
      "step_finish",
    ]);
  });

  test.each([
    [
      "an unknown tool",
      call("c1", "subtract", { a: 1 }),
      /no tool named "subtract"/,
    ],
    [
      "arguments that aren't JSON",
      call("c1", "add", "{a: 1"),
      /not valid JSON/,
    ],
    [
      "arguments that aren't an object",
      call("c1", "add", "[1, 2]"),
      /must be a JSON object/,
    ],
    [
      "arguments that don't match the parameters",
      call("c1", "add", { a: "one" }),
      /arguments\.b is missing[\s\S]*arguments\.a should be a number/,
    ],
  ])(
    "tells the model about %s, so it can try again",
    async (_, badCall, message) => {
      const { client } = scriptedModel([
        { role: "assistant", content: "", toolCalls: [badCall] },
        { role: "assistant", content: "Sorry." },
      ]);
      const events: AgentEvent[] = [];
      const result = await runAgent({
        client,
        messages: [{ role: "user", content: "go" }],
        tools: [addTool],
        onEvent: (e) => events.push(e),
      });

      expect(result.stopReason).toBe("done");
      const toolMessage = result.messages[1];
      expect(toolMessage.role).toBe("tool");
      expect(toolMessage.content).toMatch(/^Error: /);
      expect(toolMessage.content).toMatch(message);
      expect(events).toContainEqual(
        expect.objectContaining({ type: "tool_result", ok: false }),
      );
    },
  );

  test("accepts an array argument sent as a JSON string", async () => {
    const received: unknown[] = [];
    const { client } = scriptedModel([
      {
        role: "assistant",
        content: "",
        toolCalls: [call("c1", "sum_all", { numbers: "[1, 2, 3]" })],
      },
      { role: "assistant", content: "6" },
    ]);
    const result = await runAgent({
      client,
      messages: [{ role: "user", content: "go" }],
      tools: [
        {
          name: "sum_all",
          description: "Sums numbers",
          parameters: {
            type: "object",
            required: ["numbers"],
            properties: {
              numbers: { type: "array", items: { type: "number" } },
            },
          },
          run: (args) => {
            received.push(args.numbers);
            return "ok";
          },
        },
      ],
    });
    expect(received).toEqual([[1, 2, 3]]);
    expect(result.messages[1].content).toBe("ok");
  });

  test("still rejects a string that isn't the expected type", async () => {
    const { client } = scriptedModel([
      {
        role: "assistant",
        content: "",
        toolCalls: [call("c1", "add", { a: "[1]", b: 2 })],
      },
      { role: "assistant", content: "Sorry." },
    ]);
    const result = await runAgent({
      client,
      messages: [{ role: "user", content: "go" }],
      tools: [addTool],
    });
    expect(result.messages[1].content).toMatch(
      /arguments\.a should be a number/,
    );
  });

  test("reports a tool that throws to the model", async () => {
    const { client } = scriptedModel([
      {
        role: "assistant",
        content: "",
        toolCalls: [call("c1", "explode", {})],
      },
      { role: "assistant", content: "It failed." },
    ]);
    const result = await runAgent({
      client,
      messages: [{ role: "user", content: "go" }],
      tools: [
        {
          name: "explode",
          description: "Always fails",
          parameters: { type: "object" },
          run: () => {
            throw new Error("boom");
          },
        },
      ],
    });
    expect(result.messages[1].content).toBe("Error: explode failed: boom");
  });

  test("runs several calls in one turn in order", async () => {
    const order: number[] = [];
    const { client } = scriptedModel([
      {
        role: "assistant",
        content: "",
        toolCalls: [call("c1", "note", { n: 1 }), call("c2", "note", { n: 2 })],
      },
      { role: "assistant", content: "Done." },
    ]);
    const result = await runAgent({
      client,
      messages: [{ role: "user", content: "go" }],
      tools: [
        {
          name: "note",
          description: "Notes a number",
          parameters: { type: "object" },
          run: async (args) => {
            await new Promise((resolve) =>
              setTimeout(resolve, args.n === 1 ? 10 : 0),
            );
            order.push(args.n as number);
            return "ok";
          },
        },
      ],
    });
    expect(order).toEqual([1, 2]);
    expect(result.messages.map((m) => m.role)).toEqual([
      "assistant",
      "tool",
      "tool",
      "assistant",
    ]);
  });

  test("stops a model that keeps calling tools", async () => {
    const turns = Array.from({ length: 5 }, (_, i) => ({
      role: "assistant" as const,
      content: "",
      toolCalls: [call(`c${i}`, "add", { a: 1, b: 1 })],
    }));
    const { client, requests } = scriptedModel(turns);
    const result = await runAgent({
      client,
      messages: [{ role: "user", content: "go" }],
      tools: [addTool],
      maxSteps: 3,
    });
    expect(result.stopReason).toBe("max_steps");
    expect(requests).toHaveLength(3);
  });

  test("reports a failed model request", async () => {
    const { client } = scriptedModel([new Error("Could not reach Ollama")]);
    const result = await runAgent({
      client,
      messages: [{ role: "user", content: "go" }],
      tools: [],
    });
    expect(result).toMatchObject({
      stopReason: "error",
      error: "Could not reach Ollama",
      messages: [],
    });
  });

  test("stops when cancelled during a request", async () => {
    const controller = new AbortController();
    const client: ModelClient = {
      async respond() {
        controller.abort();
        throw new ModelRequestAborted();
      },
    };
    const result = await runAgent({
      client,
      messages: [{ role: "user", content: "go" }],
      tools: [],
      signal: controller.signal,
    });
    expect(result.stopReason).toBe("cancelled");
  });

  test("says when the model was cut off by its token limit", async () => {
    const client: ModelClient = {
      async respond() {
        return {
          message: { role: "assistant", content: "Partial" },
          finishReason: "length",
        };
      },
    };
    const result = await runAgent({
      client,
      messages: [{ role: "user", content: "go" }],
      tools: [],
    });
    expect(result.stopReason).toBe("length");
  });
});

describe("schemaProblems", () => {
  test("checks nested objects, arrays and enums", () => {
    const schema = {
      type: "object" as const,
      required: ["items"],
      properties: {
        items: {
          type: "array" as const,
          items: {
            type: "object" as const,
            required: ["op"],
            properties: {
              op: { type: "string" as const, enum: ["add", "remove"] },
            },
          },
        },
        count: { type: "integer" as const },
      },
    };
    expect(
      schemaProblems({ items: [{ op: "add" }], count: 2, extra: true }, schema),
    ).toEqual([]);
    expect(
      schemaProblems({ items: [{}, { op: "move" }], count: 1.5 }, schema),
    ).toEqual([
      "arguments.items[0].op is missing.",
      'arguments.items[1].op should be one of: "add", "remove".',
      "arguments.count should be an integer.",
    ]);
  });
});
