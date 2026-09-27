import { createHash } from "crypto";
import { readFileSync } from "fs";
import path from "path";
import { estimateEnergyWh } from "../ecologits/ecologits";
import upstream from "../ecologits/upstream.json";
import { LLMProvider } from "../models";
import {
  describeStats,
  ecologitsModel,
  formatEnergyRange,
  statsToMetavars,
  withEnergyEstimates,
} from "../responseStats";

describe("EcoLogits port", () => {
  it("keeps models.json exactly as EcoLogits published it", () => {
    const file = readFileSync(
      path.join(__dirname, "..", "ecologits", "models.json"),
    );
    expect(createHash("sha256").update(file).digest("hex")).toBe(
      upstream.sha256["models.json"],
    );
  });

  // [provider, model, output tokens, latency (s), min Wh, max Wh], from
  // EcoLogits 0.11.1's own llm_impacts(provider, model, tokens, latency)
  const reference: [string, string, number, number, number, number][] = [
    [
      "openai",
      "gpt-4o-mini",
      300,
      4.2,
      0.01951170332301384,
      0.023611483309942404,
    ],
    ["openai", "gpt-5", 1500, 30.0, 2.028655337526642, 3.012602534389498],
    [
      "anthropic",
      "claude-sonnet-4-5",
      800,
      12.0,
      1.051270887340051,
      1.8306764172745558,
    ],
    [
      "anthropic",
      "claude-opus-4-6",
      50,
      0.5,
      0.14857210742246177,
      0.29352259540080883,
    ],
    [
      "google_genai",
      "gemini-2.5-flash",
      1000,
      6.0,
      1.2119011091750638,
      2.0857919899443704,
    ],
    [
      "mistralai",
      "mistral-medium-latest",
      400,
      5.0,
      0.16430476527862747,
      0.21714637399904008,
    ],
    [
      "huggingface_hub",
      "mistralai/Mixtral-8x7B-Instruct-v0.1",
      200,
      100.0,
      0.03455232955742273,
      0.03613729880317606,
    ],
    [
      "cohere",
      "command-a-03-2025",
      500,
      2.0,
      0.23181768932615884,
      0.23181768932615884,
    ],
  ];
  it.each(reference)(
    "matches EcoLogits for %s/%s",
    (provider, model, tokens, latency, min, max) => {
      const wh = estimateEnergyWh(provider, model, tokens, latency);
      expect(wh?.min).toBeCloseTo(min, 12);
      expect(wh?.max).toBeCloseTo(max, 12);
    },
  );

  it("has no estimate for models EcoLogits doesn't have", () => {
    expect(estimateEnergyWh("openai", "no-such-model", 100, 1)).toBeUndefined();
    expect(estimateEnergyWh("ollama", "llama3.2", 100, 1)).toBeUndefined();
  });
});

describe("ecologitsModel", () => {
  it("finds models of the providers EcoLogits covers", () => {
    expect(ecologitsModel("gpt-4o-mini", LLMProvider.OpenAI)).toEqual([
      "openai",
      "gpt-4o-mini",
    ]);
    expect(ecologitsModel("claude-opus-4-6", LLMProvider.Anthropic)).toEqual([
      "anthropic",
      "claude-opus-4-6",
    ]);
    expect(ecologitsModel("gemini-2.5-flash", LLMProvider.Google)).toEqual([
      "google_genai",
      "gemini-2.5-flash",
    ]);
    expect(
      ecologitsModel(
        "huggingface/mistralai/Mixtral-8x7B-Instruct-v0.1:together",
        LLMProvider.HuggingFace,
      ),
    ).toEqual(["huggingface_hub", "mistralai/Mixtral-8x7B-Instruct-v0.1"]);
  });

  it("reads OpenRouter IDs, whose spelling differs a little", () => {
    expect(
      ecologitsModel(
        "openrouter/anthropic/claude-sonnet-4.5",
        LLMProvider.OpenRouter,
      ),
    ).toEqual(["anthropic", "claude-sonnet-4.5"]);
    expect(
      ecologitsModel("openrouter/openai/gpt-4o-mini", LLMProvider.OpenRouter),
    ).toEqual(["openai", "gpt-4o-mini"]);
    expect(
      ecologitsModel(
        "openrouter/google/gemini-2.5-flash",
        LLMProvider.OpenRouter,
      ),
    ).toEqual(["google_genai", "gemini-2.5-flash"]);
  });

  it("leaves out local models and providers EcoLogits doesn't cover", () => {
    expect(ecologitsModel("gpt-4o-mini", LLMProvider.Ollama)).toBeUndefined();
    expect(
      ecologitsModel("deepseek-chat", LLMProvider.DeepSeek),
    ).toBeUndefined();
    expect(
      ecologitsModel("openrouter/x-ai/grok-4", LLMProvider.OpenRouter),
    ).toBeUndefined();
  });
});

describe("withEnergyEstimates", () => {
  it("adds each response's estimate, and it shows in metavars and the tooltip", () => {
    const [stats] = withEnergyEstimates(
      [{ latency_ms: 4200, output_tokens: 300 }],
      "gpt-4o-mini",
      LLMProvider.OpenAI,
    )!;
    expect(stats?.est_energy_wh).toEqual({ min: 0.0195, max: 0.0236 });
    expect(statsToMetavars(stats!)).toMatchObject({
      stat_est_energy_wh_min: 0.0195,
      stat_est_energy_wh_max: 0.0236,
    });
    expect(describeStats(stats!).join("\n")).toMatch(
      /Energy: 0\.019–0\.024 Wh \(estimated with EcoLogits .+, not measured\)/,
    );
  });

  it("needs output tokens and latency", () => {
    const stats = [{ latency_ms: 4200 }, null];
    expect(
      withEnergyEstimates(stats, "gpt-4o-mini", LLMProvider.OpenAI),
    ).toEqual(stats);
  });

  it("formats ranges and single values", () => {
    expect(formatEnergyRange({ min: 0.2112, max: 0.5812 })).toBe(
      "0.21–0.58 Wh",
    );
    expect(formatEnergyRange({ min: 0.232, max: 0.232 })).toBe("0.23 Wh");
    expect(formatEnergyRange({ min: 12.4, max: 18.9 })).toBe("12–19 Wh");
  });
});
