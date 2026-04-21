import { webRetrievalState } from "@/tools/webRetrievalState";

describe("webRetrievalState", () => {
  // Restore defaults before each test so tests are independent.
  beforeEach(() => {
    webRetrievalState.reset();
  });

  describe("initial state", () => {
    it("has terminateRequested set to false", () => {
      expect(webRetrievalState.terminateRequested).toBe(false);
    });

    it("has activeFetchCount set to 0", () => {
      expect(webRetrievalState.activeFetchCount).toBe(0);
    });

    it("has an empty fetchLog array", () => {
      expect(webRetrievalState.fetchLog).toEqual([]);
    });
  });

  describe("terminateRequested", () => {
    it("can be set to true", () => {
      webRetrievalState.terminateRequested = true;
      expect(webRetrievalState.terminateRequested).toBe(true);
    });
  });

  describe("activeFetchCount", () => {
    it("can be incremented", () => {
      webRetrievalState.activeFetchCount += 1;
      expect(webRetrievalState.activeFetchCount).toBe(1);
    });

    it("can be decremented back to 0", () => {
      webRetrievalState.activeFetchCount += 1;
      webRetrievalState.activeFetchCount -= 1;
      expect(webRetrievalState.activeFetchCount).toBe(0);
    });

    it("supports multiple increments", () => {
      webRetrievalState.activeFetchCount += 3;
      expect(webRetrievalState.activeFetchCount).toBe(3);
    });
  });

  describe("fetchLog", () => {
    it("can be pushed to", () => {
      webRetrievalState.fetchLog.push("Fetching https://example.com");
      expect(webRetrievalState.fetchLog).toHaveLength(1);
      expect(webRetrievalState.fetchLog[0]).toBe("Fetching https://example.com");
    });

    it("accumulates multiple entries in order", () => {
      webRetrievalState.fetchLog.push("entry-1");
      webRetrievalState.fetchLog.push("entry-2");
      expect(webRetrievalState.fetchLog).toEqual(["entry-1", "entry-2"]);
    });
  });

  describe("reset()", () => {
    it("restores terminateRequested to false after mutation", () => {
      webRetrievalState.terminateRequested = true;
      webRetrievalState.reset();
      expect(webRetrievalState.terminateRequested).toBe(false);
    });

    it("restores activeFetchCount to 0 after mutation", () => {
      webRetrievalState.activeFetchCount = 5;
      webRetrievalState.reset();
      expect(webRetrievalState.activeFetchCount).toBe(0);
    });

    it("clears fetchLog after entries were pushed", () => {
      webRetrievalState.fetchLog.push("log entry");
      webRetrievalState.reset();
      expect(webRetrievalState.fetchLog).toEqual([]);
    });

    it("resets all fields simultaneously", () => {
      webRetrievalState.terminateRequested = true;
      webRetrievalState.activeFetchCount = 3;
      webRetrievalState.fetchLog.push("a", "b");

      webRetrievalState.reset();

      expect(webRetrievalState.terminateRequested).toBe(false);
      expect(webRetrievalState.activeFetchCount).toBe(0);
      expect(webRetrievalState.fetchLog).toEqual([]);
    });
  });
});
