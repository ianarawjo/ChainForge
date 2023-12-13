import { autofill, generateAndReplace } from "../ai";

describe("autofill", () => {
  it("should return an array of n rows", async () => {
    const input = ["1", "2", "3", "4", "5"];
    const n = 3;
    const result = await autofill(input, n);
    expect(result).toHaveLength(n);
    result.forEach((row) => {
      expect(typeof row).toBe("string");
    });
  });
});

describe("generateAndReplace", () => {
  it("should return an array of n rows", async () => {
    const prompt = "animals";
    const n = 3;
    const result = await generateAndReplace(prompt, n);
    expect(result).toHaveLength(n);
    result.forEach((row) => {
      expect(typeof row).toBe("string");
    });
  });
});