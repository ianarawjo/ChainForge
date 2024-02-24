import {
  union,
  isSubset,
  isExtension,
  isExtensionIgnoreEmpty,
  isEqual,
} from "../setUtils";

describe("setUtils", () => {
  describe("isEqual", () => {
    it("returns true if two sets are equal", () => {
      const setA = new Set([1, 2, 3]);
      const setB = new Set([1, 2, 3]);
      expect(isEqual(setA, setB)).toBe(true);
    });

    it("returns false if two sets are not equal", () => {
      const setA = new Set([1, 2, 3]);
      const setB = new Set([1, 2, 4]);
      expect(isEqual(setA, setB)).toBe(false);
    });
  });

  describe("union", () => {
    it("returns the union of two sets", () => {
      const setA = new Set([1, 2, 3]);
      const setB = new Set([2, 3, 4]);
      const expected = new Set([1, 2, 3, 4]);
      expect(union(setA, setB)).toEqual(expected);
    });
  });

  describe("isSubset", () => {
    it("returns true if A is a subset of B", () => {
      const setA = new Set([1, 2]);
      const setB = new Set([1, 2, 3]);
      expect(isSubset(setA, setB)).toBe(true);
    });

    it("returns false if A is not a subset of B", () => {
      const setA = new Set([1, 2, 3]);
      const setB = new Set([1, 2]);
      expect(isSubset(setA, setB)).toBe(false);
    });
  });

  describe("isExtension", () => {
    it("returns true if A is an extension of B and C", () => {
      const setA = new Set([1, 2, 3]);
      const setB = new Set([1, 2]);
      const setC = new Set([3, 4]);
      expect(isExtension(setA, setB, setC)).toBe(true);
    });

    it("returns false if A is not an extension of B and C", () => {
      const setA = new Set([1, 3, 4]);
      const setB = new Set([1, 2]);
      const setC = new Set([3, 4]);
      expect(isExtension(setA, setB, setC)).toBe(false);
    });
  });

  describe("isExtensionIgnoreEmpty", () => {
    it("returns true if A is an extension of B and C, ignoring empty strings", () => {
      const setA = ["", "1", "2", "", "3"];
      const setB = ["", "1", "2", ""];
      const setC = ["3", "4", ""];
      expect(isExtensionIgnoreEmpty(setA, setB, setC)).toBe(true);
    });

    it("returns false if A is not an extension of B and C, ignoring empty strings", () => {
      const setA = ["", "1", "3", "", "4"];
      const setB = ["", "1", "2", ""];
      const setC = ["3", "4", ""];
      expect(isExtensionIgnoreEmpty(setA, setB, setC)).toBe(false);
    });

    it("return true on this real-life color example", () => {
      const setA = [
        "Red",
        "Sky Blue",
        "Deep Purple",
        "Sunshine Yellow",
        "Midnight Black",
        "Emerald Green",
        "Electric Pink",
        "Arctic White",
        "",
        "",
      ];
      const setB = [
        "Red",
        "Sky Blue",
        "Deep Purple",
        "Sunshine Yellow",
        "Midnight Black",
        "Emerald Green",
        "Electric Pink",
        "",
        "",
        "",
      ];
      const setC = [
        "Arctic White",
        "Ocean Blue",
        "Fiery Orange",
        "Lavender Purple",
        "Goldenrod Yellow",
      ];
      expect(isExtensionIgnoreEmpty(setA, setB, setC)).toBe(true);
    });
  });
});
