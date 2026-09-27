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
  ENERGY_KEY,
  describeStats,
  formatStats,
  plottableStat,
  statsFromReply,
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
    const before = Date.now();
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
    // When the reply arrived (20 ms ago), by the machine's clock
    expect(params.reply_epoch_ms).toBeLessThanOrEqual(before - 19);
    expect(params.reply_epoch_ms).toBeGreaterThan(before - 1000);
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

  test("asks again a minute after the server couldn't be reached", async () => {
    let now = 1_000_000;
    const clock = jest.spyOn(Date, "now").mockImplementation(() => now);
    try {
      mockBackend.mockImplementationOnce(async () => {
        throw new TypeError("Failed to fetch"); // e.g. the server restarting
      });
      const { beginEnergy } = load();
      const url = "http://localhost:11434/api/chat";
      expect(await beginEnergy(url)).toBe(undefined);
      // Not asked again straight away...
      now += 30_000;
      expect(await beginEnergy(url)).toBe(undefined);
      const asked = () =>
        mockBackend.mock.calls.filter(([r]) => r === "energyStatus").length;
      expect(asked()).toBe(1);
      // ...but a minute on, it is, and the answer is kept
      now += 31_000;
      expect(await beginEnergy(url)).toBe("7");
      expect(await beginEnergy(url)).toBe("7");
      expect(asked()).toBe(2);
    } finally {
      clock.mockRestore();
    }
  });

  test('keeps the server\'s own "not available"', async () => {
    mockBackend.mockImplementation(async () => ({ available: false }));
    const { beginEnergy } = load();
    await beginEnergy("http://localhost:11434/api");
    await beginEnergy("http://localhost:11434/api");
    expect(mockBackend).toHaveBeenCalledTimes(1);
  });

  test("gives up on a server that doesn't answer", async () => {
    jest.useFakeTimers();
    try {
      mockBackend.mockImplementation((route: string) =>
        route === "energyEnd"
          ? new Promise(() => undefined) // never answers
          : Promise.resolve({ available: true, id: "7" }),
      );
      const { endEnergy } = load();
      const ended = endEnergy("7", 0, {
        load_s: 0,
        generation_s: 1,
        total_s: 1,
      });
      jest.advanceTimersByTime(5_001);
      await expect(ended).resolves.toBe(undefined);
    } finally {
      jest.useRealTimers();
    }
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
    // Parts in the same unit as the total
    expect(
      describeStats({
        energy_wh: 1500,
        energy_parts_wh: { gpu: 1000, cpu: 500 },
      }),
    ).toContain("  GPU 1 · CPU 0.5 kWh");
    // What it was measured under, which changes the energy the same work takes
    const onBattery = describeStats({
      ...stats,
      energy_conditions: {
        power_source: "battery",
        power_mode: "Low Power",
        thermal: "nominal",
      },
    });
    expect(onBattery).toContain("  Measured on battery, in Low Power Mode");
    expect(
      describeStats({
        ...stats,
        energy_conditions: {
          power_source: "AC power",
          power_mode: "Automatic",
          thermal: "serious",
        },
        energy_conditions_changed: true,
        energy_baseline_before_change: true,
      }),
    ).toEqual(
      expect.arrayContaining([
        "  Measured on AC power, in Automatic power mode, while the Mac was hot (serious)",
        "  The power settings changed during this request",
        "  Idle power is from before the power settings changed",
      ]),
    );
    expect(describeStats({ ...stats, energy_shared: true })).toContain(
      "  Shared with requests generating at the same time",
    );
  });

  test("on a PC: each GPU, what isn't measured, and other programs on the GPU", () => {
    const pc: ResponseStats = {
      energy_wh: 0.2,
      energy_parts_wh: { gpu0: 0.15, gpu1: 0.05 },
      energy_conditions: {
        power_source: "AC power",
        power_mode: "Balanced power plan, Best performance",
        gpu_power_limit: "GPU 1 limited to 300 W (default 450 W)",
        thermal: "the GPU was slowed by heat",
      },
      energy_other_gpu_use: ["ComfyUI", "python"],
    };
    expect(describeStats(pc)).toEqual(
      expect.arrayContaining([
        "  GPU 0 150 · GPU 1 50 mWh",
        "  GPU only: this machine's CPU isn't measured",
        "  Measured on AC power, with the Balanced power plan, Best performance, with GPU 1 limited to 300 W (default 450 W), while the GPU was slowed by heat",
        "  Other programs used the GPU meanwhile (ComfyUI, python): their energy is counted in this",
      ]),
    );
    const lines = (s: ResponseStats) => describeStats(s).join("\n");
    // Defaults aren't worth a mention
    expect(
      lines({
        ...pc,
        energy_conditions: {
          power_source: "AC power",
          power_mode: "performance power profile",
          gpu_power_limit: "default",
          thermal: "nominal",
        },
      }),
    ).toContain("  Measured on AC power, with the performance power profile\n");
    expect(
      lines({ ...pc, energy_conditions: { power_mode: "Battery saver" } }),
    ).toContain("  Measured with Battery saver on");
    // A CPU-only machine (Linux without an NVIDIA GPU)
    expect(
      describeStats({ energy_wh: 0.1, energy_parts_wh: { cpu: 0.1 } }),
    ).toContain("  CPU only: this machine's GPU isn't measured");
    // A Mac measures both
    expect(lines(stats)).not.toMatch(/only:/);
  });

  test("keeps the other programs from the server's measurement", () => {
    const withOthers = (other_gpu_use: unknown) =>
      statsFromReply({ [ENERGY_KEY]: { energy_wh: 0.1, other_gpu_use } });
    expect(withOthers(["ComfyUI"])?.energy_other_gpu_use).toEqual(["ComfyUI"]);
    expect(withOthers([])?.energy_other_gpu_use).toBeUndefined();
    expect(withOthers(null)?.energy_other_gpu_use).toBeUndefined();
  });

  test("as metavars and a Vis Node value, in mWh", () => {
    expect(
      statsToMetavars({
        ...stats,
        energy_conditions: { power_source: "battery", power_mode: "Low Power" },
      }),
    ).toMatchObject({
      stat_energy_wh: 0.0853,
      stat_load_energy_wh: 0.00303,
      stat_power_source: "battery",
      stat_power_mode: "Low Power",
    });
    const stat = plottableStat("__stat_energy_mwh")!;
    expect(stat.value(stats)).toBeCloseTo(85.3, 6);
    expect(stat.describe(stats)).toBe("Energy: 85 mWh (measured, above idle)");
  });
});
