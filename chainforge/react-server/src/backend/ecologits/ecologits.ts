/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * A port of the energy estimate of EcoLogits (https://github.com/mlco2/ecologits),
 * ecologits/impacts/llm.py and ecologits/tracers/utils.py, at the release in
 * upstream.json. The data (models.json) and constants (method.json) are
 * EcoLogits' own, copied by sync.py; only the formulas below are ported by hand.
 */
import modelsData from "./models.json";
import method from "./method.json";

/** An EcoLogits estimate: a range, as the inputs it's built from often are. */
export type EnergyRange = { min: number; max: number };

type ValueOrRange = number | EnergyRange;

type Architecture =
  | { type: "dense"; parameters: ValueOrRange }
  | { type: "moe"; parameters: { total: ValueOrRange; active: ValueOrRange } };

type Model = {
  provider: string;
  name: string;
  architecture: Architecture;
  deployment?: { tps?: number | null; ttft?: number | null } | null;
};

const C = method.constants;
const PROVIDERS = method.providers as Record<
  string,
  { datacenter_pue: ValueOrRange }
>;

const lo = (v: ValueOrRange) => (typeof v === "number" ? v : v.min);
const hi = (v: ValueOrRange) => (typeof v === "number" ? v : v.max);

// Model lookup: EcoLogits matches (provider, name) exactly. ChainForge also
// accepts a name that differs only in case or "." for "-" (e.g. OpenRouter's
// "claude-sonnet-4.5" for "claude-sonnet-4-5"), where that names one model.
const normalize = (name: string) => name.toLowerCase().replace(/\./g, "-");
const exact = new Map<string, Model>();
const loose = new Map<string, Model | null>(); // null: more than one model

function addName(model: Model, name: string) {
  exact.set(`${model.provider}/${name}`, model);
  const key = `${model.provider}/${normalize(name)}`;
  const prev = loose.get(key);
  loose.set(key, prev === undefined || prev === model ? model : null);
}
(modelsData.models as Model[]).forEach((m) => addName(m, m.name));
modelsData.aliases.forEach((a) => {
  const model = exact.get(`${a.provider}/${a.alias}`);
  if (model) addName(model, a.name);
});

/** The EcoLogits record for a model of an EcoLogits provider (e.g. "openai", "gpt-4o"), if it has one. */
export function findModel(provider: string, name: string): Model | undefined {
  return (
    exact.get(`${provider}/${name}`) ??
    loose.get(`${provider}/${normalize(name)}`) ??
    undefined
  );
}

/** llm.py: the energy of one GPU generating the output, in kWh. */
function gpuEnergy(activeParams: number, outputTokens: number): number {
  const perToken =
    (C.GPU_ENERGY_ALPHA *
      Math.exp(C.GPU_ENERGY_BETA * C.BATCH_SIZE) *
      activeParams +
      C.GPU_ENERGY_GAMMA) /
    1000;
  return outputTokens * perToken;
}

/** llm.py: how long the GPUs spent generating, in seconds, at most the request's latency. */
function generationLatency(
  activeParams: number,
  outputTokens: number,
  requestLatencyS: number,
  tps?: number | null,
  ttft?: number | null,
): number {
  const perToken = tps
    ? 1 / tps
    : C.LATENCY_ALPHA * activeParams +
      C.LATENCY_BETA * C.BATCH_SIZE +
      C.LATENCY_GAMMA;
  const latency = outputTokens * perToken + (ttft ?? 0);
  return requestLatencyS < latency ? requestLatencyS : latency;
}

/** llm.py: how many GPUs the model's weights take, rounded up to a power of two. */
function gpuCount(totalParams: number): number {
  const memoryGB = (1.2 * totalParams * C.MODEL_QUANTIZATION_BITS) / 8;
  const gpus = Math.ceil(memoryGB / C.GPU_MEMORY);
  return 2 ** Math.ceil(Math.log2(gpus));
}

/** llm.py: the energy of one request, in kWh, before the data centre's overhead. */
function itEnergy(
  activeParams: number,
  totalParams: number,
  outputTokens: number,
  requestLatencyS: number,
  model: Model,
): number {
  const latency = generationLatency(
    activeParams,
    outputTokens,
    requestLatencyS,
    model.deployment?.tps,
    model.deployment?.ttft,
  );
  const gpus = gpuCount(totalParams);
  const server =
    (latency / 3600) *
    C.SERVER_POWER *
    (gpus / C.SERVER_GPUS) *
    (1 / C.BATCH_SIZE);
  return server + gpus * gpuEnergy(activeParams, outputTokens);
}

/**
 * EcoLogits' estimate of the energy a request used, in Wh (EcoLogits reports
 * kWh), as `llm_impacts` computes it. Where a model's size or its provider's
 * data-centre overhead (PUE) is only known as a range, so is the estimate.
 *
 * @param provider An EcoLogits provider, e.g. "openai" or "google_genai".
 * @param outputTokens Generated tokens. EcoLogits doesn't count input tokens.
 * @param requestLatencyS The request's measured latency, in seconds.
 */
export function estimateEnergyWh(
  provider: string,
  name: string,
  outputTokens: number,
  requestLatencyS: number,
): EnergyRange | undefined {
  const model = findModel(provider, name);
  const config = PROVIDERS[provider];
  if (!model || !config) return undefined;

  const arch = model.architecture;
  const active = arch.type === "moe" ? arch.parameters.active : arch.parameters;
  const total = arch.type === "moe" ? arch.parameters.total : arch.parameters;

  // As compute_llm_impacts: once with the smallest sizes, once with the largest
  const pue = config.datacenter_pue;
  const kWh = {
    min:
      lo(pue) *
      itEnergy(lo(active), lo(total), outputTokens, requestLatencyS, model),
    max:
      hi(pue) *
      itEnergy(hi(active), hi(total), outputTokens, requestLatencyS, model),
  };
  return { min: kWh.min * 1000, max: kWh.max * 1000 };
}
