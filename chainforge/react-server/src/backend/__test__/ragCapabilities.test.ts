import { beforeEach, describe, expect, test, jest } from "@jest/globals";

// ragCapabilities reads RAG_AVAILABLE from utils, which is a mutable module
// export set either synchronously from a Flask-injected window flag or
// asynchronously from a backend probe. Stub the module so each test can pin it,
// and so the real utils (with its ESM provider SDKs and load-time probe) stays
// out of the way.
jest.mock("../utils", () => ({ RAG_AVAILABLE: undefined }));

// Fetched after the hoisted jest.mock, then mutated per test. ragCapabilities
// reads RAG_AVAILABLE as a live binding, so changing it here is visible there.
const mockUtils = jest.requireMock("../utils") as {
  RAG_AVAILABLE: boolean | undefined;
};

// eslint-disable-next-line import/first
import {
  anyRagFeatureAvailable,
  canRunNow,
  ragBackendAvailable,
  ragLimitationNotice,
  ragNodeAvailable,
  willRunInBrowser,
} from "../ragCapabilities";

const withBackend = () => {
  mockUtils.RAG_AVAILABLE = true;
};
const withoutBackend = () => {
  mockUtils.RAG_AVAILABLE = false;
};
const beforeProbeResolves = () => {
  mockUtils.RAG_AVAILABLE = undefined;
};

beforeEach(withoutBackend);

describe("ragBackendAvailable", () => {
  test("true only when the backend reported the rag extra", () => {
    withBackend();
    expect(ragBackendAvailable()).toBe(true);
  });

  test("false without a backend", () => {
    expect(ragBackendAvailable()).toBe(false);
  });

  test("false while the availability probe is still pending", () => {
    // Must not be treated as available just because it isn't yet known.
    beforeProbeResolves();
    expect(ragBackendAvailable()).toBe(false);
  });
});

describe("canRunNow", () => {
  test("browser capabilities always run", () => {
    expect(canRunNow("browser")).toBe(true);
    withBackend();
    expect(canRunNow("browser")).toBe(true);
  });

  test("dual capabilities always run", () => {
    expect(canRunNow("both")).toBe(true);
  });

  test("backend capabilities need the backend", () => {
    expect(canRunNow("backend")).toBe(false);
    withBackend();
    expect(canRunNow("backend")).toBe(true);
  });
});

describe("willRunInBrowser", () => {
  test("browser-only capabilities run client-side", () => {
    expect(willRunInBrowser("browser")).toBe(true);
  });

  test("dual capabilities run client-side even with a backend present", () => {
    // Deliberate: a flow should chunk the same way in either mode.
    withBackend();
    expect(willRunInBrowser("both")).toBe(true);
  });

  test("backend capabilities never run client-side", () => {
    withBackend();
    expect(willRunInBrowser("backend")).toBe(false);
  });
});

describe("ragNodeAvailable", () => {
  test("every RAG node is available with a backend", () => {
    withBackend();
    for (const node of ["upload", "chunk", "retrieval", "rerank"] as const)
      expect(ragNodeAvailable(node)).toBe(true);
  });

  test("upload and chunk work without a backend", () => {
    expect(ragNodeAvailable("upload")).toBe(true);
    expect(ragNodeAvailable("chunk")).toBe(true);
  });

  test("retrieval works without a backend, via the keyword methods", () => {
    expect(ragNodeAvailable("retrieval")).toBe(true);
  });

  test("rerank still needs a backend", () => {
    // Cross-encoders need a model; Cohere rerank needs its API.
    expect(ragNodeAvailable("rerank")).toBe(false);
  });

  test("nothing is available-by-accident before the probe resolves", () => {
    beforeProbeResolves();
    expect(ragNodeAvailable("rerank")).toBe(false);
  });
});

describe("anyRagFeatureAvailable", () => {
  test("true without a backend, since the browser nodes work", () => {
    expect(anyRagFeatureAvailable()).toBe(true);
  });

  test("true with a backend", () => {
    withBackend();
    expect(anyRagFeatureAvailable()).toBe(true);
  });
});

describe("ragLimitationNotice", () => {
  test("explains the limitation when there is no backend", () => {
    expect(ragLimitationNotice()).toMatch(/without a local ChainForge server/);
  });

  test("silent when everything is available", () => {
    withBackend();
    expect(ragLimitationNotice()).toBeUndefined();
  });
});
