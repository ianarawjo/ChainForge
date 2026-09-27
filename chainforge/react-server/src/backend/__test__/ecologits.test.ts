import { createHash } from "crypto";
import { readFileSync } from "fs";
import path from "path";
import * as ecologits from "../ecologits/ecologits";
import { estimateEnergyWh } from "../ecologits/ecologits";
import upstream from "../ecologits/upstream.json";
import { LLMProvider } from "../models";
import { set_api_keys, usesCustomOpenAIEndpoint } from "../utils";
import {
  describeStats,
  ecologitsModel,
  energyEstimator,
  extract_stats,
  formatEnergy,
  formatEnergyRange,
  formatStats,
  LATENCY_KEY,
  statsToMetavars,
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
    // Typed "moe" but given one parameter count, which EcoLogits reads as dense
    [
      "cohere",
      "command-a-plus-05-2026",
      500,
      2.0,
      0.729278345249806,
      0.729278345249806,
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

describe("energy estimates in extract_stats", () => {
  const gpt4oMini = energyEstimator("gpt-4o-mini", LLMProvider.OpenAI);

  it("adds each response's estimate, and it shows in metavars and the tooltip", () => {
    const [stats] = extract_stats(
      { choices: [{}], usage: { completion_tokens: 300 }, [LATENCY_KEY]: 4200 },
      4200,
      1,
      gpt4oMini,
    )!;
    expect(stats?.est_energy_wh).toEqual({ min: 0.0195, max: 0.0236 });
    expect(statsToMetavars(stats!)).toMatchObject({
      stat_est_energy_wh_min: 0.0195,
      stat_est_energy_wh_max: 0.0236,
    });
    expect(describeStats(stats!)).toContain(
      "Energy: 20–24 mWh (estimated by EcoLogits)",
    );
    expect(formatStats(stats!, true)).toBe("4.2 s · 71 tok/s · ~22 mWh");
  });

  it("estimates a request once, and shares it between the responses it returned", () => {
    const whole = estimateEnergyWh("openai", "gpt-5", 1500, 30)!;
    const stats = extract_stats(
      {
        choices: [{}, {}, {}, {}, {}],
        usage: { completion_tokens: 1500 },
        [LATENCY_KEY]: 30000,
      },
      30000,
      5,
      energyEstimator("gpt-5", LLMProvider.OpenAI),
    )!;
    expect(stats).toHaveLength(5);
    const sum = stats.reduce((a, s) => a + s!.est_energy_wh!.max, 0);
    expect(sum).toBeCloseTo(whole.max, 2);
    // Not the same as estimating each response's 300 tokens on its own
    expect(stats[0]!.est_energy_wh!.max).not.toBeCloseTo(
      estimateEnergyWh("openai", "gpt-5", 300, 30)!.max,
      3,
    );
  });

  it("needs output tokens and latency", () => {
    const stats = extract_stats({ choices: [{}] }, 4200, 1, gpt4oMini)!;
    expect(stats[0]).toEqual({ latency_ms: 4200 });
  });

  it("keeps the response's other stats if the estimate fails", () => {
    const spy = jest
      .spyOn(ecologits, "estimateEnergyWh")
      .mockImplementation(() => {
        throw new Error("unexpected data");
      });
    const warn = jest.spyOn(console, "warn").mockImplementation(() => {});
    try {
      const [stats] = extract_stats(
        {
          choices: [{}],
          usage: { completion_tokens: 300 },
          [LATENCY_KEY]: 4200,
        },
        4200,
        1,
        energyEstimator("gpt-4o-mini", LLMProvider.OpenAI),
      )!;
      expect(stats).toMatchObject({ latency_ms: 4200, output_tokens: 300 });
      expect(stats?.est_energy_wh).toBeUndefined();
    } finally {
      spy.mockRestore();
      warn.mockRestore();
    }
  });

  it("has no estimator for models EcoLogits doesn't cover", () => {
    expect(energyEstimator("llama3.2", LLMProvider.Ollama)).toBeUndefined();
  });

  it("formats energy in the unit that suits it", () => {
    expect(formatEnergy(0.0078)).toBe("7.8 mWh");
    expect(formatEnergy(0.02)).toBe("20 mWh");
    expect(formatEnergy(0.00041)).toBe("0.41 mWh");
    expect(formatEnergy(1.84)).toBe("1.8 Wh");
    expect(formatEnergy(2500)).toBe("2.5 kWh");
    // Both ends of a range share the larger's unit
    expect(formatEnergyRange({ min: 0.0078, max: 0.02 })).toBe("7.8–20 mWh");
    expect(formatEnergyRange({ min: 0.4, max: 1.2 })).toBe("0.4–1.2 Wh");
    expect(formatEnergyRange({ min: 0.232, max: 0.232 })).toBe("230 mWh");
    expect(formatEnergyRange({ min: 12.4, max: 18.9 })).toBe("12–19 Wh");
  });
});

describe("custom OpenAI endpoints", () => {
  it("counts only a base URL other than OpenAI's as custom", () => {
    expect(usesCustomOpenAIEndpoint()).toBe(false);
    set_api_keys({ OpenAI_BaseURL: "http://localhost:1234/v1" });
    expect(usesCustomOpenAIEndpoint()).toBe(true);
    set_api_keys({ OpenAI_BaseURL: "https://api.openai.com/v1" });
    expect(usesCustomOpenAIEndpoint()).toBe(false);
  });
});
