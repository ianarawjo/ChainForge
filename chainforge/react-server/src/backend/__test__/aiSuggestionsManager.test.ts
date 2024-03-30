import AISuggestionsManager from "../aiSuggestionsManager";

describe("AISuggestionsManager", () => {
  let suggestionsManager: AISuggestionsManager;
  let mockRows: string[];

  beforeEach(() => {
    suggestionsManager = new AISuggestionsManager(() => "OpenAI");
    mockRows = ["one", "two", "three"];
  });

  describe("update", () => {
    it("should clear suggestions if necessary", () => {
      jest.useFakeTimers();
      suggestionsManager.suggestions = [...mockRows];
      suggestionsManager.update(["one", "", ""]);
      jest.runAllTimers();
      expect(suggestionsManager.suggestions).toEqual([]);
    });
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
