// scripts/__tests__/mailbox-ingest.test.mjs
// isAutoSender 순수 함수 + fetchInbox URL 인코딩 단위 테스트 (RED→GREEN)

import { describe, it, expect, vi, afterEach } from "vitest";
import { isAutoSender, fetchInbox } from "../mailbox-ingest.mjs";

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

describe("fetchInbox URL 인코딩 (mail-read 정합, OData 리터럴 $)", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  function mockFetch() {
    const spy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue({ ok: true, json: async () => ({ value: [] }) });
    return spy;
  }

  it("키는 리터럴 $, 공백은 %20 (URLSearchParams %24 회귀 방지)", async () => {
    const spy = mockFetch();
    await fetchInbox("tok", "ops@example.com", "2026-06-01T00:00:00Z");
    const url = spy.mock.calls[0][0];

    expect(url).not.toContain("%24");
    expect(url).toContain("$top=50");
    expect(url).toContain("$orderby=receivedDateTime%20desc");
    expect(url).toContain(
      "$select=id,subject,bodyPreview,body,from,receivedDateTime,isRead",
    );
    expect(url).toContain(
      "$filter=receivedDateTime%20gt%202026-06-01T00%3A00%3A00Z",
    );
  });

  it("since 없으면 $filter 미포함", async () => {
    const spy = mockFetch();
    await fetchInbox("tok", "ops@example.com");
    const url = spy.mock.calls[0][0];

    expect(url).not.toContain("$filter");
    expect(url).not.toContain("%24");
    expect(url).toContain("$top=50");
  });
});
