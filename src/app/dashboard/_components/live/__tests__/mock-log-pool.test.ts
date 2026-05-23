import { describe, it, expect } from "vitest";
import { ConsoleLogEntry, INITIAL_CONSOLE_LINES } from "../mock-log-pool";

describe("mock-log-pool", () => {
  it("ConsoleLogType union includes 'debug' type", () => {
    const entry: ConsoleLogEntry = { text: "[TEST] debug", type: "debug" };
    expect(entry.type).toBe("debug");
  });

  it("INITIAL_CONSOLE_LINES renders without error", () => {
    expect(INITIAL_CONSOLE_LINES).toHaveLength(3);
    expect(INITIAL_CONSOLE_LINES[0].type).toBe("info");
  });
});
