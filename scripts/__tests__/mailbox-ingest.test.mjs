// scripts/__tests__/mailbox-ingest.test.mjs
// isAutoSender 순수 함수 단위 테스트 (RED→GREEN)

import { describe, it, expect } from "vitest";
import { isAutoSender } from "../mailbox-ingest.mjs";

describe("isAutoSender", () => {
  it("null/undefined → true (skip)", () => {
    expect(isAutoSender(null)).toBe(true);
    expect(isAutoSender(undefined)).toBe(true);
    expect(isAutoSender("")).toBe(true);
  });

  it("no-reply 변형 → skip", () => {
    expect(isAutoSender("noreply@example.com")).toBe(true);
    expect(isAutoSender("no-reply@example.com")).toBe(true);
    expect(isAutoSender("NO-REPLY@SCHOOL.AC.KR")).toBe(true);
  });

  it("mailer-daemon → skip", () => {
    expect(isAutoSender("mailer-daemon@domain.com")).toBe(true);
    expect(isAutoSender("MAILER-DAEMON@domain.com")).toBe(true);
  });

  it("postmaster → skip", () => {
    expect(isAutoSender("postmaster@domain.com")).toBe(true);
  });

  it("newsletter → skip", () => {
    expect(isAutoSender("newsletter@company.com")).toBe(true);
    expect(isAutoSender("Newsletter@example.org")).toBe(true);
  });

  it("일반 발신자 → not skip", () => {
    expect(isAutoSender("student@university.ac.kr")).toBe(false);
    expect(isAutoSender("admissions@school.edu")).toBe(false);
    expect(isAutoSender("contact@example.com")).toBe(false);
  });
});
