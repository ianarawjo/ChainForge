/*
 * @jest-environment jsdom
 */
// The ChainForge server, and whether the page is on this machine
const mockBackend = jest.fn();
let mockRunningLocally = true;
jest.mock("../utils", () => ({
  APP_IS_RUNNING_LOCALLY: () => mockRunningLocally,
  call_flask_backend: (route: string, params: any) =>
    mockBackend(route, params),
}));

// eslint-disable-next-line import/first
import { beforeEach, describe, expect, test } from "@jest/globals";
// eslint-disable-next-line import/first
import {
  describeStats,
  formatStats,
  plottableStat,
  statsToMetavars,
} from "../responseStats";
// eslint-disable-next-line import/first
import { ResponseStats } from "../typing";

// A fresh module for each test, since it remembers whether energy can be measured
const load = () => {
  let mod: typeof import("../localEnergy") | undefined;
  jest.isolateModules(() => {
    mod = require("../localEnergy");
  });
  return mod!;
};

const measured = {
  energy_wh: 0.0853,
  noise_wh: 0.00035,
  components_wh: { gpu: 0.0464, cpu: 0.0198, dram: 0.0192 },
  load_energy_wh: 0.00303,
  shared: false,
};

beforeEach(() => {
  mockRunningLocally = true;
  mockBackend.mockReset().mockImplementation(async (route: string) => {
    if (route === "energyStatus") return { available: true };
    if (route === "energyBegin") return { id: "7" };
    if (route === "energyEnd") return { energy: measured };
    return {};
  });
});

describe("measuring local models' energy", () => {
  test("only for a model server on this machine", () => {
    const { isLoopbackUrl } = load();
    expect(isLoopbackUrl("http://localhost:11434/api/chat")).toBe(true);
    expect(isLoopbackUrl("http://127.0.0.1:11434/")).toBe(true);
    expect(isLoopbackUrl("http://[::1]:11434/")).toBe(true);
    expect(isLoopbackUrl("http://192.168.1.20:11434/")).toBe(false);
    expect(isLoopbackUrl("http://gpu-box.lab:11434/")).toBe(false);
    expect(isLoopbackUrl("not a url")).toBe(false);
  });

  test("marks a request as started and finished, with the server's timings", async () => {
    const { beginEnergy, endEnergy } = load();
    const id = await beginEnergy("http://localhost:11434/api/chat");
    expect(id).toBe("7");
    const energy = await endEnergy(id, performance.now() - 20, {
      load_s: 1.58,
      generation_s: 5.49,
      total_s: 7.1,
    });
    expect(energy).toEqual(measured);
    const [, params] = mockBackend.mock.calls.find(([r]) => r === "energyEnd")!;
    expect(params).toMatchObject({
      id: "7",
      load_s: 1.58,
      generation_s: 5.49,
      total_s: 7.1,
    });
    expect(params.since_reply_ms).toBeGreaterThanOrEqual(20);
  });

  test("asks whether energy can be measured only once", async () => {
    const { beginEnergy } = load();
    await beginEnergy("http://localhost:11434/api/chat");
    await beginEnergy("http://localhost:11434/api/chat");
    expect(
      mockBackend.mock.calls.filter(([r]) => r === "energyStatus"),
    ).toHaveLength(1);
  });

  test("not for a remote model server, a hosted page, or a machine without a meter", async () => {
    expect(await load().beginEnergy("http://192.168.1.20:11434/api")).toBe(
      undefined,
    );
    mockRunningLocally = false;
    expect(await load().beginEnergy("http://localhost:11434/api")).toBe(
      undefined,
    );
    mockRunningLocally = true;
    mockBackend.mockImplementation(async () => ({ available: false }));
    expect(await load().beginEnergy("http://localhost:11434/api")).toBe(
      undefined,
    );
    expect(mockBackend).not.toHaveBeenCalledWith("energyBegin", {});
  });

  test("a request without timings is dropped, not measured", async () => {
    const { endEnergy } = load();
    await endEnergy("7", performance.now());
    await endEnergy("8", performance.now(), {
      load_s: NaN,
      generation_s: 1,
      total_s: 1,
    });
    expect(mockBackend).toHaveBeenCalledWith("energyEnd", {
      id: "7",
      cancelled: true,
    });
    expect(mockBackend).toHaveBeenCalledWith("energyEnd", {
      id: "8",
      cancelled: true,
    });
  });

  test("never fails a request", async () => {
    mockBackend.mockImplementation(async () => {
      throw new TypeError("Failed to fetch");
    });
    const { beginEnergy, endEnergy } = load();
    expect(await beginEnergy("http://localhost:11434/api")).toBe(undefined);
    expect(
      await endEnergy("7", 0, { load_s: 0, generation_s: 1, total_s: 1 }),
    ).toBe(undefined);
  });
});

describe("showing measured energy", () => {
  const stats: ResponseStats = {
    latency_ms: 5490,
    output_tokens: 507,
    tokens_per_s: 92.3,
    energy_wh: 0.0853,
    energy_noise_wh: 0.00035,
    energy_parts_wh: { gpu: 0.0464, cpu: 0.0198, dram: 0.0192, ane: 0 },
    load_energy_wh: 0.00303,
  };

  test("on the stats label, as measured (no ~)", () => {
    expect(formatStats(stats, true)).toBe("5.5 s · 92 tok/s · 85 mWh");
  });

  test("in the tooltip, above idle, with its parts and the model load apart", () => {
    const lines = describeStats(stats);
    expect(lines).toContain(
      "Energy: 85 mWh (measured on this machine, above idle power, ± 0.35 mWh)",
    );
    expect(lines).toContain("  GPU 46 · CPU 20 · memory 19 mWh");
    expect(lines).toContain("Loading the model: 3 mWh (not included above)");
    expect(describeStats({ ...stats, energy_shared: true })).toContain(
      "  Shared with requests generating at the same time",
    );
  });

  test("as metavars and a Vis Node value, in mWh", () => {
    expect(statsToMetavars(stats)).toMatchObject({
      stat_energy_wh: 0.0853,
      stat_load_energy_wh: 0.00303,
    });
    const stat = plottableStat("__stat_energy_mwh")!;
    expect(stat.value(stats)).toBeCloseTo(85.3, 6);
    expect(stat.describe(stats)).toBe("Energy: 85 mWh (measured, above idle)");
  });
});
