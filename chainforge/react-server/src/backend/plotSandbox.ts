/**
 * Runs plot code an AI wrote, safely.
 *
 * The code runs in a Web Worker inside an iframe with `sandbox="allow-scripts"`
 * and no `allow-same-origin`, so it has an opaque origin: it can't reach
 * ChainForge's page, storage or cookies. A Content Security Policy blocks
 * every network request, so it can't send the data anywhere either. The worker
 * keeps an endless loop from freezing the page, and a timeout removes the
 * iframe (and with it the worker) if the code never finishes. Only the figure,
 * as JSON, comes back.
 */
import { Dict } from "./typing";
import { PlotContext, PlotRow } from "./aiPlots";

/** A Plotly figure. */
export interface PlotFigure {
  data: Dict[];
  layout?: Dict;
}

const DEFAULT_TIMEOUT_MS = 10000;
const MAX_FIGURE_CHARS = 5_000_000;

// Defines the AI's code, calls plot(), and returns the figure as JSON, or the error.
const RUN_SOURCE = `function run(data) {
  try {
    const plot = new Function(
      data.code + "\\n;return typeof plot === 'function' ? plot : undefined;",
    )();
    if (!plot) throw new Error("The code doesn't define a function called plot.");
    return { ok: true, figure: JSON.stringify(plot(data.rows, data.context)) };
  } catch (err) {
    return { ok: false, error: String((err && err.message) || err) };
  }
}`;

// The sandboxed page: runs the code in a worker, or in the page itself if the
// browser won't start a worker there. Either way, only JSON goes back.
const SANDBOX_HTML = `<!doctype html>
<html><head>
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline' 'unsafe-eval' blob:; worker-src blob:">
</head><body><script>
${RUN_SOURCE}
const WORKER_SOURCE = ${JSON.stringify(`${RUN_SOURCE}
self.onmessage = (e) => self.postMessage(run(e.data));`)};
window.addEventListener("message", (e) => {
  if (e.source !== parent) return;
  const reply = (msg) => parent.postMessage(msg, "*");
  let worker;
  try {
    worker = new Worker(URL.createObjectURL(new Blob([WORKER_SOURCE], { type: "text/javascript" })));
  } catch (err) {
    reply(run(e.data));
    return;
  }
  worker.onmessage = (m) => reply(m.data);
  worker.onerror = (err) => reply({ ok: false, error: err.message || "The plot code failed." });
  worker.postMessage(e.data);
});
parent.postMessage({ ready: true }, "*");
</script></body></html>`;

/** Checks that code returned a Plotly figure. */
export function parseFigure(json: string | undefined): PlotFigure {
  if (json === undefined) throw new Error("plot() didn't return a figure.");
  if (json.length > MAX_FIGURE_CHARS)
    throw new Error("The figure plot() returned is too large to show.");
  const figure = JSON.parse(json);
  if (!figure || typeof figure !== "object" || !Array.isArray(figure.data))
    throw new Error(
      "plot() must return a Plotly figure: an object with a `data` array.",
    );
  if (figure.layout !== undefined && typeof figure.layout !== "object")
    throw new Error("The figure's `layout` must be an object.");

  // Figures render on ChainForge's page, outside the sandbox, so leave out
  // what makes Plotly load things from the web: images and map tiles, which
  // could otherwise carry the data off in their URLs.
  if (
    figure.data.some((trace: Dict) =>
      /map|image/i.test(String(trace?.type ?? "")),
    )
  )
    throw new Error("Map and image plots aren't supported.");
  const layout = { ...figure.layout };
  for (const key of ["images", "mapbox", "map", "geo", "template"])
    delete layout[key];
  return { data: figure.data, layout };
}

/**
 * Runs plot code over the rows, in a sandbox, returning the figure it made.
 * Rejects with the code's error, if it throws or doesn't return a figure.
 */
export function runPlotCode(
  code: string,
  rows: PlotRow[],
  context: PlotContext,
  timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<PlotFigure> {
  return new Promise((resolve, reject) => {
    const iframe = document.createElement("iframe");
    iframe.setAttribute("sandbox", "allow-scripts");
    iframe.style.display = "none";
    iframe.srcdoc = SANDBOX_HTML;

    let settled = false;
    const finish = (settle: () => void) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      window.removeEventListener("message", onMessage);
      iframe.remove();
      settle();
    };
    const timer = setTimeout(
      () =>
        finish(() =>
          reject(
            new Error(
              `The plot code didn't finish within ${timeoutMs / 1000} seconds.`,
            ),
          ),
        ),
      timeoutMs,
    );

    const onMessage = (e: MessageEvent) => {
      if (e.source !== iframe.contentWindow) return;
      const msg = e.data ?? {};
      if (msg.ready) {
        iframe.contentWindow?.postMessage({ code, rows, context }, "*");
      } else if (msg.ok) {
        finish(() => {
          try {
            resolve(parseFigure(msg.figure));
          } catch (err) {
            reject(err);
          }
        });
      } else {
        finish(() => reject(new Error(msg.error ?? "The plot code failed.")));
      }
    };
    window.addEventListener("message", onMessage);
    document.body.appendChild(iframe);
  });
}
