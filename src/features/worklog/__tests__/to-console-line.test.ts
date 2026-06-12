import { describe, it, expect } from "vitest";
import {
  worklogRowToConsoleLine,
  worklogRowsToConsoleLines,
} from "../to-console-line";

describe("worklogRowToConsoleLine", () => {
  it("INFO → type=info, [DOMAIN] msg 형식", () => {
    expect(
      worklogRowToConsoleLine({ level: "INFO", domain: "incidents", msg: "X" }),
    ).toEqual({
      text: "[INCIDENTS] X",
      type: "info",
    });
  });
  it("DEBUG → type=debug (muted cream)", () => {
    expect(
      worklogRowToConsoleLine({ level: "DEBUG", domain: "nav", msg: "Y" }).type,
    ).toBe("debug");
  });
  it("WARN → type=warn", () => {
    expect(
      worklogRowToConsoleLine({ level: "WARN", domain: "ai", msg: "Z" }).type,
    ).toBe("warn");
  });
  it("ERROR → type=err", () => {
    expect(
      worklogRowToConsoleLine({ level: "ERROR", domain: "auth", msg: "W" })
        .type,
    ).toBe("err");
  });
  it("domain 소문자 → 대문자 변환", () => {
    expect(
      worklogRowToConsoleLine({ level: "INFO", domain: "handover", msg: "a" })
        .text,
    ).toBe("[HANDOVER] a");
  });
  it("user_name 있으면 [DOMAIN] {이름} · {msg} 형식", () => {
    expect(
      worklogRowToConsoleLine({
        level: "INFO",
        domain: "nav",
        msg: "페이지 진입 — 운영부 달력",
        user_name: "김지나",
      }).text,
    ).toBe("[NAV] 김지나 · 페이지 진입 — 운영부 달력");
  });
  it("user_name 없으면(null) 이름 없이 [DOMAIN] {msg}", () => {
    expect(
      worklogRowToConsoleLine({
        level: "INFO",
        domain: "sys",
        msg: "부팅",
        user_name: null,
      }).text,
    ).toBe("[SYS] 부팅");
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
