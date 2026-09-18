// A Jest environment with Node's real network APIs, for liveAgent.test.ts.
// Jest 27's node environment leaves out fetch and its companions, which the
// openai SDK needs to reach a real model.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const NodeEnvironment = require("jest-environment-node");

const NETWORK_GLOBALS = [
  "fetch",
  "Headers",
  "Request",
  "Response",
  "FormData",
  "Blob",
  "File",
  "ReadableStream",
  "TextDecoderStream",
  "AbortController",
  "AbortSignal",
  "DOMException",
];

class LiveEnvironment extends NodeEnvironment {
  async setup() {
    await super.setup();
    for (const name of NETWORK_GLOBALS)
      if (globalThis[name] !== undefined) this.global[name] = globalThis[name];
  }
}

module.exports = LiveEnvironment;
