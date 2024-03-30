import { autofill, generateAndReplace } from "../ai";

const apiKeys = {
  OpenAI: process.env.OPENAI_API_KEY,
  AWS_Access_Key_ID: process.env.AWS_ACCESS_KEY_ID,
  AWS_Secret_Access_Key: process.env.AWS_SECRET_ACCESS_KEY,
  AWS_Session_Token: process.env.AWS_SESSION_TOKEN,
};

describe("autofill-openai", () => {
  if (!apiKeys.OpenAI) {
    return;
  }
  it("should return an array of n rows", async () => {
    const input = ["1", "2", "3", "4", "5"];
    const n = 3;
    const result = await autofill(input, n, "OpenAI", apiKeys);
    expect(result).toHaveLength(n);
    result.forEach((row) => {
      expect(typeof row).toBe("string");
    });
  });
});

describe("generateAndReplace-openai", () => {
  if (!apiKeys.OpenAI) {
    return;
  }
  it("should return an array of n rows", async () => {
    const prompt = "animals";
    const n = 3;
    const result = await generateAndReplace(
      prompt,
      n,
      false,
      "OpenAI",
      apiKeys,
    );
    expect(result).toHaveLength(n);
    result.forEach((row) => {
      expect(typeof row).toBe("string");
    });
  });
});

describe("autofill-bedrock-anthropic", () => {
  if (!apiKeys.AWS_Access_Key_ID) {
    return;
  }
  it("should return an array of n rows", async () => {
    const input = ["1", "2", "3", "4", "5"];
    const n = 3;
    const result = await autofill(input, n, "Bedrock", apiKeys);
    expect(result).toHaveLength(n);
    result.forEach((row) => {
      expect(typeof row).toBe("string");
    });
  });
});

describe("generateAndReplace-bedrock-anthropic", () => {
  if (!apiKeys.AWS_Access_Key_ID) {
    return;
  }
  it("should return an array of n rows", async () => {
    const prompt = "animals";
    const n = 3;
    const result = await generateAndReplace(
      prompt,
      n,
      false,
      "Bedrock",
      apiKeys,
    );
    expect(result).toHaveLength(n);
    result.forEach((row) => {
      expect(typeof row).toBe("string");
    });
  });
});
