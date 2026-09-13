/*
 * @jest-environment jsdom
 */

// Same module stubs as minimax.test.ts, plus a MediaLookup that serves input
// images, so the provider calls can be tested without their dependencies.
jest.mock("../cache", () => ({
  __esModule: true,
  default: class StorageCache {
    static getInstance() {
      return new StorageCache();
    }
  },
  StringLookup: { get: (x: unknown) => x },
  MediaLookup: {
    get: async (uid: string) =>
      new (globalThis as any).Blob([`bytes of ${uid}`], { type: "image/png" }),
  },
}));
jest.mock("@google/genai", () => ({ GoogleGenAI: jest.fn() }));
jest.mock("@azure/openai", () => ({
  AzureKeyCredential: jest.fn(),
  OpenAIClient: jest.fn(),
}));
jest.mock("../pyodide/exec-py", () => ({ execPy: jest.fn() }));
jest.mock("../../store", () => ({
  __esModule: true,
  default: {
    getState: () => ({ AvailableLLMs: [], setAvailableLLMs: jest.fn() }),
  },
}));

// eslint-disable-next-line import/first
// (jest itself is the global: jest.mock factories may not reference imports.)
import { beforeAll, describe, expect, test } from "@jest/globals";
// eslint-disable-next-line import/first
import {
  call_gemini_image_gen,
  call_google_ai,
  call_openai_image_gen,
  extract_responses,
  set_api_keys,
} from "../utils";
// eslint-disable-next-line import/first
import {
  LLMProvider,
  NativeLLM,
  getProvider,
  isGeminiImageModel,
  isOpenAIImageModel,
} from "../models";
// eslint-disable-next-line import/first
import {
  ModelSettings,
  baseModelToProvider,
  getSettingsSchemaForLLM,
} from "../../ModelSettingSchemas";
// eslint-disable-next-line import/first
import { Dict } from "../typing";

type Call = { url: string; init: RequestInit };
let calls: Call[] = [];

/** Replaces fetch with one returning the given responses in order (repeating the last). */
const mockFetch = (...responses: { status?: number; body: unknown }[]) => {
  calls = [];
  let i = 0;
  (globalThis as any).fetch = jest.fn(
    async (url: string, init: RequestInit) => {
      calls.push({ url, init });
      const { status = 200, body } =
        responses[Math.min(i++, responses.length - 1)];
      return {
        ok: status >= 200 && status < 300,
        status,
        json: async () => body,
      };
    },
  );
};

const jsonBody = (call: Call) => JSON.parse(call.init.body as string);
const headers = (call: Call) => call.init.headers as Record<string, string>;

const geminiReply = (parts: Dict[], finishReason = "STOP") => ({
  candidates: [{ content: { parts }, finishReason }],
});

beforeAll(() => {
  set_api_keys({ OpenAI: "sk-test", Google: "g-test" });
});

describe("recognizing image models", () => {
  test("OpenAI image models, including dated snapshots", () => {
    expect(isOpenAIImageModel("gpt-image-2.5-flare")).toBe(true);
    expect(isOpenAIImageModel("gpt-image-2-2026-04-21")).toBe(true);
    expect(isOpenAIImageModel("dall-e-3")).toBe(true);
    expect(isOpenAIImageModel("gpt-5")).toBe(false);
  });

  test("Gemini image models, but not Gemini text models", () => {
    expect(isGeminiImageModel("gemini-3.1-flash-image")).toBe(true);
    expect(isGeminiImageModel("gemini-3-pro-image")).toBe(true);
    expect(isGeminiImageModel("models/gemini-2.5-flash-image")).toBe(true);
    expect(isGeminiImageModel("gemini-2.5-flash")).toBe(false);
  });

  test("new models map to their providers", () => {
    expect(getProvider(NativeLLM.OpenAI_GPT_Image_2_5_Sunburst)).toBe(
      LLMProvider.OpenAI,
    );
    expect(getProvider(NativeLLM.GEMINI_v3_1_flash_image)).toBe(
      LLMProvider.Google,
    );
    expect(baseModelToProvider("gemini-image")).toBe(LLMProvider.Google);
  });

  test("image models get their own settings forms", () => {
    const gpt = getSettingsSchemaForLLM("gpt-image-2.5-sunburst");
    expect(gpt?.schema.properties.quality.enum).toContain("xhigh");
    expect(gpt).toBe(ModelSettings["gpt-image-1"]);

    const gemini = getSettingsSchemaForLLM("gemini-3-pro-image");
    expect(gemini?.schema.properties.aspect_ratio).toBeDefined();
    expect(gemini).toBe(ModelSettings["gemini-image"]);

    // Text Gemini models keep the text settings.
    expect(
      getSettingsSchemaForLLM("gemini-2.5-flash")?.schema.properties.top_k,
    ).toBeDefined();
  });
});

describe("OpenAI image generation", () => {
  test("sends a generations request with the settings that apply", async () => {
    mockFetch({ body: { data: [{ b64_json: "AAAA" }] } });
    const [query, images] = await call_openai_image_gen(
      "a cat",
      NativeLLM.OpenAI_GPT_Image_2_5_Flare,
      1,
      0,
      {
        quality: "xhigh",
        size: "1536x864",
        output_format: "png",
        output_compression: 80, // png: dropped
        input_fidelity: "high", // not editing: dropped
        background: "", // empty: dropped
      },
    );

    expect(calls).toHaveLength(1);
    expect(calls[0].url).toMatch(/\/images\/generations$/);
    expect(headers(calls[0]).Authorization).toBe("Bearer sk-test");
    expect(jsonBody(calls[0])).toEqual({
      model: "gpt-image-2.5-flare",
      prompt: "a cat",
      quality: "xhigh",
      size: "1536x864",
      output_format: "png",
      n: 1,
    });
    expect(query.model).toBe("gpt-image-2.5-flare");
    expect(images).toEqual([{ b64_json: "AAAA" }]);
  });

  test("compression is kept for lossy formats", async () => {
    mockFetch({ body: { data: [{ b64_json: "AAAA" }] } });
    await call_openai_image_gen("a cat", "gpt-image-2", 1, 0, {
      output_format: "webp",
      output_compression: 70,
    });
    expect(jsonBody(calls[0]).output_compression).toBe(70);
  });

  test("more than 10 images are requested in batches", async () => {
    const tenImages = { data: Array(10).fill({ b64_json: "X" }) };
    const twoImages = { data: Array(2).fill({ b64_json: "Y" }) };
    mockFetch({ body: tenImages }, { body: twoImages });

    const [, images] = await call_openai_image_gen(
      "a cat",
      "gpt-image-2",
      12,
      0,
    );
    expect(calls.map((c) => jsonBody(c).n)).toEqual([10, 2]);
    expect(images).toHaveLength(12);
  });

  test("input images go to the edits endpoint as multipart images", async () => {
    mockFetch({ body: { data: [{ b64_json: "EDIT" }] } });
    const [query] = await call_openai_image_gen(
      "make it blue",
      "gpt-image-1.5",
      1,
      0,
      { input_fidelity: "high", quality: "high" },
      undefined,
      ["uid-1", "uid-2"],
    );

    expect(calls[0].url).toMatch(/\/images\/edits$/);
    const form = calls[0].init.body as FormData;
    expect(form).toBeInstanceOf(FormData);
    expect(form.getAll("image[]")).toHaveLength(2);
    expect(form.get("input_fidelity")).toBe("high");
    expect(form.get("model")).toBe("gpt-image-1.5");
    expect(form.get("n")).toBe("1");
    // The browser sets the multipart Content-Type (with its boundary) itself.
    expect(headers(calls[0])["Content-Type"]).toBeUndefined();
    // The cached query records the input count, not the image bytes.
    expect(query.input_images).toBe(2);
  });

  test("gpt-image-2 edits omit input_fidelity, which it doesn't take", async () => {
    mockFetch({ body: { data: [{ b64_json: "EDIT" }] } });
    await call_openai_image_gen(
      "make it blue",
      "gpt-image-2",
      1,
      0,
      { input_fidelity: "high" },
      undefined,
      ["uid-1"],
    );
    expect((calls[0].init.body as FormData).get("input_fidelity")).toBeNull();
  });

  test("a moderation block surfaces the API's reason", async () => {
    mockFetch({
      status: 400,
      body: {
        error: {
          message: "Your request was rejected by the safety system.",
          code: "moderation_blocked",
          moderation_details: { categories: ["violence"] },
        },
      },
    });
    await expect(
      call_openai_image_gen("something", "gpt-image-2", 1, 0),
    ).rejects.toThrow(/rejected by the safety system.*violence/);
  });

  test("DALL·E explains that it was shut down, without calling the API", async () => {
    mockFetch({ body: {} });
    await expect(
      call_openai_image_gen("a cat", NativeLLM.OpenAI_DallE_3, 1, 0),
    ).rejects.toThrow(/shut down dall-e-3/);
    expect(calls).toHaveLength(0);
  });

  test("responses are extracted as images", () => {
    expect(
      extract_responses(
        [{ b64_json: "AAAA" }],
        "gpt-image-2.5-sunburst",
        LLMProvider.OpenAI,
      ),
    ).toEqual([{ t: "img", d: "AAAA" }]);
  });
});

describe("Gemini image generation", () => {
  const imageReply = geminiReply([
    { text: "Here is your image." },
    { inlineData: { mimeType: "image/png", data: "R0VNSU5J" } },
  ]);

  test("sends generateContent with image config and input images", async () => {
    mockFetch({ body: imageReply });
    const [query, responses] = await call_gemini_image_gen(
      "a cat",
      "gemini-3.1-flash-image",
      1,
      1,
      { aspect_ratio: "16:9", image_size: "2K", system_msg: "Be bold." },
      undefined,
      ["uid-1"],
    );

    expect(calls[0].url).toBe(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-image:generateContent",
    );
    expect(headers(calls[0])["x-goog-api-key"]).toBe("g-test");

    const body = jsonBody(calls[0]);
    expect(body.generationConfig).toEqual({
      responseModalities: ["IMAGE"],
      temperature: 1,
      imageConfig: { aspectRatio: "16:9", imageSize: "2K" },
    });
    expect(body.systemInstruction).toEqual({ parts: [{ text: "Be bold." }] });
    const [textPart, imagePart] = body.contents[0].parts;
    expect(textPart).toEqual({ text: "a cat" });
    expect(imagePart.inlineData.mimeType).toBe("image/png");
    expect(imagePart.inlineData.data.length).toBeGreaterThan(0);

    // The cached query records the input count, not the image bytes.
    expect(query.input_images).toBe(1);
    expect(JSON.stringify(query)).not.toContain(imagePart.inlineData.data);
    expect(responses).toHaveLength(1);
  });

  test("auto settings are left to the model", async () => {
    mockFetch({ body: imageReply });
    await call_gemini_image_gen("a cat", "gemini-3-pro-image", 1, 1, {
      aspect_ratio: "auto",
      image_size: "auto",
      response_modalities: "TEXT_AND_IMAGE",
    });
    const config = jsonBody(calls[0]).generationConfig;
    expect(config.imageConfig).toBeUndefined();
    expect(config.responseModalities).toEqual(["TEXT", "IMAGE"]);
  });

  test("n images take n requests", async () => {
    mockFetch({ body: imageReply });
    const [, responses] = await call_gemini_image_gen(
      "a cat",
      "gemini-3.1-flash-image",
      3,
      1,
    );
    expect(calls).toHaveLength(3);
    expect(responses).toHaveLength(3);
  });

  test("a blocked generation fails with the reason", async () => {
    mockFetch({ body: geminiReply([], "IMAGE_SAFETY") });
    await expect(
      call_gemini_image_gen("something", "gemini-3.1-flash-image", 1, 1),
    ).rejects.toThrow(/IMAGE_SAFETY/);
  });

  test("an API error surfaces its message", async () => {
    mockFetch({
      status: 403,
      body: { error: { message: "Image generation requires billing." } },
    });
    await expect(
      call_gemini_image_gen("a cat", "gemini-3.1-flash-image", 1, 1),
    ).rejects.toThrow("Image generation requires billing.");
  });

  test("the Google provider routes image models to this call", async () => {
    mockFetch({ body: imageReply });
    await call_google_ai("a cat", "gemini-3-pro-image", 1, 1, {});
    expect(calls[0].url).toContain("gemini-3-pro-image:generateContent");
  });

  test("images are extracted; a text-only reply is kept as text", () => {
    expect(
      extract_responses(
        [imageReply],
        "gemini-3.1-flash-image",
        LLMProvider.Google,
      ),
    ).toEqual([{ t: "img", d: "R0VNSU5J" }]);

    const declined = geminiReply([{ text: "I can't make that image." }]);
    expect(
      extract_responses(
        [declined],
        "gemini-3.1-flash-image",
        LLMProvider.Google,
      ),
    ).toEqual(["I can't make that image."]);
  });
});
