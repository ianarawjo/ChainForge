/*
 * @jest-environment jsdom
 */
import { beforeEach, describe, expect, test } from "@jest/globals";
import {
  cleanAPIKeys,
  forgetStoredAPIKeys,
  loadStoredAPIKeys,
  storeAPIKeys,
} from "../apiKeyStorage";

const STORAGE_KEY = "chainforge-api-keys";

beforeEach(() => {
  window.sessionStorage.clear();
  window.localStorage.clear();
});

describe("API key storage for the web version", () => {
  test("by default keys are kept for the tab only, trimmed, without blanks", () => {
    storeAPIKeys({ OpenRouter: " sk-or-1\n", OpenAI: "", Google: "  " }, false);
    expect(window.localStorage.getItem(STORAGE_KEY)).toBeNull();
    expect(loadStoredAPIKeys()).toEqual({
      keys: { OpenRouter: "sk-or-1" },
      remembered: false,
    });
  });

  test("remembered keys are kept on the device, and only there", () => {
    storeAPIKeys({ OpenRouter: "sk-or-1" }, false);
    storeAPIKeys({ OpenRouter: "sk-or-2" }, true);
    expect(window.sessionStorage.getItem(STORAGE_KEY)).toBeNull();
    expect(loadStoredAPIKeys()).toEqual({
      keys: { OpenRouter: "sk-or-2" },
      remembered: true,
    });
  });

  test("no longer remembering removes the keys from the device", () => {
    storeAPIKeys({ OpenRouter: "sk-or-1" }, true);
    storeAPIKeys({ OpenRouter: "sk-or-1" }, false);
    expect(window.localStorage.getItem(STORAGE_KEY)).toBeNull();
    expect(loadStoredAPIKeys().remembered).toBe(false);
  });

  test("clearing every key clears the storage", () => {
    storeAPIKeys({ OpenRouter: "sk-or-1" }, false);
    storeAPIKeys({ OpenRouter: "" }, false);
    expect(window.sessionStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  test("forgetting removes keys from the tab and the device", () => {
    window.sessionStorage.setItem(STORAGE_KEY, '{"OpenAI":"sk-1"}');
    window.localStorage.setItem(STORAGE_KEY, '{"OpenRouter":"sk-or-1"}');
    forgetStoredAPIKeys();
    expect(loadStoredAPIKeys()).toEqual({ keys: {}, remembered: false });
  });

  test("malformed stored data is ignored", () => {
    window.localStorage.setItem(STORAGE_KEY, "not json");
    window.sessionStorage.setItem(STORAGE_KEY, '{"OpenAI": 5}');
    expect(loadStoredAPIKeys()).toEqual({ keys: {}, remembered: false });
  });

  test("cleanAPIKeys trims and drops non-strings", () => {
    expect(cleanAPIKeys({ a: " x ", b: 3, c: "" })).toEqual({ a: "x" });
  });
});
