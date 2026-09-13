// The Pyodide loader uses import.meta, which CRA's CommonJS Jest cannot parse.
jest.mock("../pyodide/exec-py", () => ({
  execPy: () => Promise.reject(new Error("execPy is unavailable in tests")),
}));

// The app's store and ModelSettingSchemas import each other, so importing the
// real store during a test evaluates it mid-cycle and its schema-derived
// constants come back undefined. These tests don't exercise the store, so stub
// it (same approach as minimax.test.ts).
jest.mock("../../store", () => ({
  __esModule: true,
  default: {
    getState: () => ({ AvailableLLMs: [], setAvailableLLMs: () => undefined }),
  },
}));

// eslint-disable-next-line import/first
import AISuggestionsManager from "../aiSuggestionsManager";

describe("AISuggestionsManager", () => {
  let suggestionsManager: AISuggestionsManager;
  let mockRows: string[];

  beforeEach(() => {
    suggestionsManager = new AISuggestionsManager(() => "OpenAI");
    mockRows = ["one", "two", "three"];
  });

  describe("peekSuggestions", () => {
    it("should return the current suggestions", () => {
      suggestionsManager.suggestions = [...mockRows];
      expect(suggestionsManager.peekSuggestions()).toEqual(mockRows);
    });
  });

  describe("popSuggestion", () => {
    it("should return and remove the first suggestion by default", () => {
      suggestionsManager.suggestions = [...mockRows];
      const firstSuggestion = mockRows[0];
      expect(suggestionsManager.popSuggestion()).toEqual(firstSuggestion);
      expect(suggestionsManager.suggestions).toEqual(mockRows.slice(1));
    });

    it("should return and remove the suggestion at the given index", () => {
      suggestionsManager.suggestions = [...mockRows];
      const secondSuggestion = mockRows[1];
      expect(suggestionsManager.popSuggestion(1)).toEqual(secondSuggestion);
      expect(suggestionsManager.suggestions).toEqual(
        mockRows.slice(0, 1).concat(mockRows.slice(2)),
      );
    });
  });

  describe("removeSuggestion", () => {
    it("should remove the given suggestion", () => {
      suggestionsManager.suggestions = [...mockRows];
      const secondSuggestion = mockRows[1];
      suggestionsManager.removeSuggestion(secondSuggestion);
      expect(suggestionsManager.suggestions).toEqual(
        mockRows.slice(0, 1).concat(mockRows.slice(2)),
      );
    });
  });

  describe("areSuggestionsLoading", () => {
    it("should return the current loading state", () => {
      expect(suggestionsManager.areSuggestionsLoading()).toBe(false);
      suggestionsManager.isLoading = true;
      expect(suggestionsManager.areSuggestionsLoading()).toBe(true);
    });
  });

  describe("cycleSuggestions", () => {
    it("should deterministically reorder the suggestions", () => {
      suggestionsManager.suggestions = [...mockRows];
      expect(suggestionsManager.peekSuggestions()).toEqual(mockRows);
      suggestionsManager.cycleSuggestions();
      // Except to be a recombination: not equal but set-equal
      expect(suggestionsManager.peekSuggestions()).not.toEqual(mockRows);
      expect(new Set(suggestionsManager.peekSuggestions())).toEqual(
        new Set(mockRows),
      );
    });
  });
});
