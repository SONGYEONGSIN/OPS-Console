import { describe, it, expect } from "vitest";
import { worklogRowToConsoleLine, worklogRowsToConsoleLines } from "../to-console-line";

describe("worklogRowToConsoleLine", () => {
  it("INFO → type=info, [DOMAIN] msg 형식", () => {
    expect(worklogRowToConsoleLine({ level: "INFO", domain: "incidents", msg: "X" })).toEqual({
      text: "[INCIDENTS] X",
      type: "info",
    });
  });
  it("DEBUG도 type=info", () => {
    expect(worklogRowToConsoleLine({ level: "DEBUG", domain: "nav", msg: "Y" }).type).toBe("info");
  });
  it("WARN → type=warn", () => {
    expect(worklogRowToConsoleLine({ level: "WARN", domain: "ai", msg: "Z" }).type).toBe("warn");
  });
  it("ERROR → type=err", () => {
    expect(worklogRowToConsoleLine({ level: "ERROR", domain: "auth", msg: "W" }).type).toBe("err");
  });
  it("domain 소문자 → 대문자 변환", () => {
    expect(worklogRowToConsoleLine({ level: "INFO", domain: "handover", msg: "a" }).text).toBe("[HANDOVER] a");
  });
});

describe("worklogRowsToConsoleLines", () => {
  it("DESC 입력 → 오름차순(reverse)으로 반환", () => {
    const input = [
      { level: "INFO" as const, domain: "a", msg: "new" },
      { level: "INFO" as const, domain: "b", msg: "old" },
    ];
    const out = worklogRowsToConsoleLines(input);
    expect(out[0].text).toBe("[B] old");
    expect(out[1].text).toBe("[A] new");
  });
  it("빈 배열 → []", () => {
    expect(worklogRowsToConsoleLines([])).toEqual([]);
  });
});
