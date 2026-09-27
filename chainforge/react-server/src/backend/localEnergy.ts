/**
 * Measuring the energy local models use, through the ChainForge server, which
 * reads this machine's energy counters (see chainforge/energy). A request is
 * marked as started before it's sent and as finished with the model server's
 * own timings, and the server works out its share of the energy above idle.
 *
 * Only for a model server on this same machine, with ChainForge's server
 * running here too: the counters measure this machine and nothing else.
 */
import { APP_IS_RUNNING_LOCALLY, call_flask_backend } from "./utils";

/** A request's measured energy, as the server reports it. */
export interface MeasuredEnergy {
  /** Reading the prompt and generating, above idle power. */
  energy_wh: number;
  /** How much idle power's usual swings could move `energy_wh`. */
  noise_wh: number;
  /** `energy_wh` by part of the machine, e.g. { gpu, cpu, dram }. */
  components_wh: Record<string, number>;
  /** Loading the model, when this request had to wait for it, above idle; shared by all that waited. */
  load_energy_wh: number | null;
  /** Whether its generation overlapped another request's, and so was shared. */
  shared: boolean;
  /** Power source, power mode and heat as it began, e.g. { power_source: "battery", power_mode: "Low Power", thermal: "nominal" }. */
  conditions?: Record<string, string>;
  /** Whether the power source or mode changed during it. */
  conditions_changed?: boolean;
  /** Whether idle power is from before the power settings last changed. */
  baseline_before_change?: boolean;
}

let available: Promise<boolean> | undefined;

/** Whether a URL is on this machine. */
export function isLoopbackUrl(url: string): boolean {
  try {
    const host = new URL(url).hostname.replace(/^\[|\]$/g, "");
    return host === "localhost" || host === "::1" || /^127\./.test(host);
  } catch {
    return false;
  }
}

/**
 * Whether this machine's energy can be measured, asking the ChainForge
 * server once. (The server measures idle power from when it starts.)
 */
function energyMeasurable(): Promise<boolean> {
  if (!APP_IS_RUNNING_LOCALLY()) return Promise.resolve(false);
  if (available === undefined)
    available = call_flask_backend("energyStatus", {})
      .then((status) => status?.available === true)
      .catch(() => false);
  return available;
}

/** Whether energy can be measured for a model server at `serverUrl`. */
export async function canMeasureEnergy(serverUrl: string): Promise<boolean> {
  return isLoopbackUrl(serverUrl) && (await energyMeasurable());
}

/**
 * Marks a request to the model server at `serverUrl` as started, if its
 * energy can be measured. Returns an id for `endEnergy`, or undefined.
 * Never throws: measuring energy is never worth failing a request over.
 */
export async function beginEnergy(
  serverUrl: string,
): Promise<string | undefined> {
  try {
    if (!(await canMeasureEnergy(serverUrl))) return undefined;
    const res = await call_flask_backend("energyBegin", {});
    return typeof res?.id === "string" ? res.id : undefined;
  } catch {
    return undefined;
  }
}

/**
 * A finished request's measured energy, from the model server's timings (in
 * seconds), or undefined if it couldn't be measured. Without timings, e.g.
 * for a request that failed, the request is just dropped.
 *
 * @param repliedAt When the reply arrived, by performance.now().
 */
export async function endEnergy(
  id: string | undefined,
  repliedAt: number,
  timings?: { load_s: number; generation_s: number; total_s: number },
): Promise<MeasuredEnergy | undefined> {
  if (id === undefined) return undefined;
  const valid =
    timings !== undefined &&
    Object.values(timings).every((v) => Number.isFinite(v) && v >= 0);
  try {
    const res = await call_flask_backend(
      "energyEnd",
      valid
        ? {
            id,
            // When the reply arrived, by this machine's clock, so that any
            // delay in this call reaching the server doesn't shift the windows
            reply_epoch_ms: Date.now() - (performance.now() - repliedAt),
            ...timings,
          }
        : { id, cancelled: true },
    );
    const energy = res?.energy;
    return energy && typeof energy.energy_wh === "number"
      ? (energy as MeasuredEnergy)
      : undefined;
  } catch {
    return undefined;
  }
}
