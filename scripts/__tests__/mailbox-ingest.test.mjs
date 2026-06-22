// scripts/__tests__/mailbox-ingest.test.mjs
// isAutoSender 순수 함수 + fetchInbox URL 인코딩 단위 테스트 (RED→GREEN)

import { describe, it, expect, vi, afterEach } from "vitest";
import {
  isAutoSender,
  isAdSubject,
  fetchInbox,
  fetchFolderMessages,
  collectInboxFolderIds,
  graphGetWithRetry,
} from "../mailbox-ingest.mjs";

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

  it("bulk 발신 도메인(stibee/maily/mailchimp 등) → skip", () => {
    expect(isAutoSender("hello@send.stibee.com")).toBe(true);
    expect(isAutoSender("noti@stibee.com")).toBe(true);
    expect(isAutoSender("team@maily.so")).toBe(true);
    expect(isAutoSender("campaign@list.mailchimp.com")).toBe(true);
    expect(isAutoSender("bounce@sendgrid.net")).toBe(true);
    expect(isAutoSender("relay@mailgun.org")).toBe(true);
    expect(isAutoSender("noreply@amazonses.com")).toBe(true);
    expect(isAutoSender("blast@sendpulse.com")).toBe(true);
    expect(isAutoSender("track@mktomail.com")).toBe(true);
    expect(isAutoSender("x@cmail19.com")).toBe(true);
    expect(isAutoSender("y@hubspotemail.net")).toBe(true);
    expect(isAutoSender("z@rmail.co.kr")).toBe(true);
  });

  it("bulk 서브도메인/접두(news./newsletter./mail./promotion/noti) → skip", () => {
    expect(isAutoSender("info@news.company.com")).toBe(true);
    expect(isAutoSender("hi@newsletter.brand.io")).toBe(true);
    expect(isAutoSender("x@mail.service.com")).toBe(true);
    expect(isAutoSender("promotion@shop.com")).toBe(true);
    expect(isAutoSender("noti@app.com")).toBe(true);
  });

  it("bounce/notification/donotreply/auto/marketing/promo 토큰 → skip", () => {
    expect(isAutoSender("bounce-1@domain.com")).toBe(true);
    expect(isAutoSender("notification@domain.com")).toBe(true);
    expect(isAutoSender("notifications@domain.com")).toBe(true);
    expect(isAutoSender("donotreply@domain.com")).toBe(true);
    expect(isAutoSender("do-not-reply@domain.com")).toBe(true);
    expect(isAutoSender("auto@domain.com")).toBe(true);
    expect(isAutoSender("marketing@brand.com")).toBe(true);
    expect(isAutoSender("promo@brand.com")).toBe(true);
  });

  it("info@ 단독은 과차단 위험 — skip 하지 않음", () => {
    expect(isAutoSender("info@university.ac.kr")).toBe(false);
  });

  it("사내 도메인(jinhakapply/jinhak)은 bulk 패턴 매칭돼도 절대 skip 안 함", () => {
    expect(isAutoSender("noreply@jinhakapply.com")).toBe(false);
    expect(isAutoSender("newsletter@jinhak.com")).toBe(false);
    expect(isAutoSender("noti@jinhakapply.com")).toBe(false);
    expect(isAutoSender("marketing@jinhak.com")).toBe(false);
  });
});

describe("isAdSubject", () => {
  it("(AD)/[AD]/광고 표기 → ad", () => {
    expect(isAdSubject("(광고) 여름 할인 안내")).toBe(true);
    expect(isAdSubject("(AD) Summer Sale")).toBe(true);
    expect(isAdSubject("[AD] Newsletter")).toBe(true);
    expect(isAdSubject("[광고] 이벤트")).toBe(true);
    expect(isAdSubject("주문 안내 (AD)")).toBe(true);
  });

  it("일반 제목 → not ad", () => {
    expect(isAdSubject("원서 접수 문의드립니다")).toBe(false);
    expect(isAdSubject("RE: 결제 확인 요청")).toBe(false);
    expect(isAdSubject("")).toBe(false);
    expect(isAdSubject(null)).toBe(false);
    expect(isAdSubject(undefined)).toBe(false);
  });

  it("'ADMISSION' 같은 정상 단어를 광고로 오판하지 않음", () => {
    expect(isAdSubject("Admission guide")).toBe(false);
    expect(isAdSubject("ADD 문의")).toBe(false);
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

describe("fetchFolderMessages URL 인코딩 (폴더별 일반화, OData 리터럴 $)", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  function mockFetch() {
    return vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue({ ok: true, json: async () => ({ value: [] }) });
  }

  it("folderId·email 인코딩 + 리터럴 $ + select 필드 유지", async () => {
    const spy = mockFetch();
    await fetchFolderMessages(
      "tok",
      "ops@example.com",
      "AAMk-folder-id",
      "2026-06-01T00:00:00Z",
    );
    const url = spy.mock.calls[0][0];

    expect(url).not.toContain("%24");
    expect(url).toContain("/mailFolders/AAMk-folder-id/messages");
    expect(url).toContain("/users/ops%40example.com/");
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
    await fetchFolderMessages("tok", "ops@example.com", "fid");
    const url = spy.mock.calls[0][0];
    expect(url).not.toContain("$filter");
    expect(url).not.toContain("%24");
  });
});

describe("graphGetWithRetry — 429 백오프 재시도", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("첫 호출 429(Retry-After) → 대기 후 재시도 → 200 성공", async () => {
    vi.useFakeTimers();
    let calls = 0;
    const spy = vi.spyOn(globalThis, "fetch").mockImplementation(async () => {
      calls++;
      if (calls === 1) {
        return {
          ok: false,
          status: 429,
          headers: { get: (h) => (h === "Retry-After" ? "1" : null) },
        };
      }
      return { ok: true, status: 200, json: async () => ({ value: [] }) };
    });

    const promise = graphGetWithRetry("https://graph/x", "tok");
    await vi.runAllTimersAsync();
    const res = await promise;

    expect(res.ok).toBe(true);
    expect(res.status).toBe(200);
    expect(spy).toHaveBeenCalledTimes(2);
    vi.useRealTimers();
  });

  it("maxRetries 초과해도 계속 429면 마지막 429 응답 반환(throw 안 함)", async () => {
    vi.useFakeTimers();
    const spy = vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: false,
      status: 429,
      headers: { get: () => null },
    });

    const promise = graphGetWithRetry("https://graph/x", "tok", 2);
    await vi.runAllTimersAsync();
    const res = await promise;

    expect(res.status).toBe(429);
    // 최초 1회 + 재시도 2회 = 3
    expect(spy).toHaveBeenCalledTimes(3);
    vi.useRealTimers();
  });
});

describe("collectInboxFolderIds — 재귀 + nextLink", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("inbox 자신 + 중첩 childFolders 전부 수집 (DFS, nextLink 페이지네이션)", async () => {
    // 트리:
    //   inbox(IN)
    //     ├ A (childFolders 2페이지: nextLink로 A2)
    //     │    ├ A1
    //     │    └ A2
    //     └ B
    //          └ B1
    const responses = new Map();
    // inbox 자체 조회
    responses.set("GET /users/ops%40example.com/mailFolders/inbox", {
      id: "IN",
      displayName: "받은 편지함",
    });
    // IN childFolders 페이지1 → A,B + nextLink
    responses.set(
      "GET /users/ops%40example.com/mailFolders/IN/childFolders",
      {
        value: [
          { id: "A", displayName: "A" },
          { id: "B", displayName: "B" },
        ],
      },
    );
    // A childFolders 페이지1 → A1 + nextLink(A 페이지2)
    responses.set(
      "GET /users/ops%40example.com/mailFolders/A/childFolders",
      {
        value: [{ id: "A1", displayName: "A1" }],
        "@odata.nextLink":
          "https://graph.microsoft.com/v1.0/users/ops%40example.com/mailFolders/A/childFolders?$skiptoken=PAGE2",
      },
    );
    responses.set("NEXT A page2", {
      value: [{ id: "A2", displayName: "A2" }],
    });
    responses.set(
      "GET /users/ops%40example.com/mailFolders/A1/childFolders",
      { value: [] },
    );
    responses.set(
      "GET /users/ops%40example.com/mailFolders/A2/childFolders",
      { value: [] },
    );
    responses.set(
      "GET /users/ops%40example.com/mailFolders/B/childFolders",
      { value: [{ id: "B1", displayName: "B1" }] },
    );
    responses.set(
      "GET /users/ops%40example.com/mailFolders/B1/childFolders",
      { value: [] },
    );

    vi.spyOn(globalThis, "fetch").mockImplementation(async (url) => {
      let key;
      if (url.includes("$skiptoken=PAGE2")) {
        key = "NEXT A page2";
      } else if (url.endsWith("/mailFolders/inbox")) {
        key = "GET /users/ops%40example.com/mailFolders/inbox";
      } else {
        const m = url.match(/\/mailFolders\/([^/]+)\/childFolders/);
        key = `GET /users/ops%40example.com/mailFolders/${m[1]}/childFolders`;
      }
      const payload = responses.get(key);
      if (!payload) throw new Error(`unexpected url: ${url}`);
      return { ok: true, json: async () => payload };
    });

    const ids = await collectInboxFolderIds("tok", "ops@example.com");
    expect(ids).toEqual(expect.arrayContaining(["IN", "A", "B", "A1", "A2", "B1"]));
    expect(ids).toHaveLength(6);
    // 중복 없음
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("하위 폴더 0개여도 inbox 자신은 포함", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(async (url) => {
      if (url.endsWith("/mailFolders/inbox")) {
        return { ok: true, json: async () => ({ id: "IN", displayName: "받은 편지함" }) };
      }
      return { ok: true, json: async () => ({ value: [] }) };
    });
    const ids = await collectInboxFolderIds("tok", "ops@example.com");
    expect(ids).toEqual(["IN"]);
  });

  it("childFolders 조회 URL은 리터럴 $top=100 + $select 사용 (%24 회귀 방지)", async () => {
    const seen = [];
    vi.spyOn(globalThis, "fetch").mockImplementation(async (url) => {
      seen.push(url);
      if (url.endsWith("/mailFolders/inbox")) {
        return { ok: true, json: async () => ({ id: "IN" }) };
      }
      return { ok: true, json: async () => ({ value: [] }) };
    });
    await collectInboxFolderIds("tok", "ops@example.com");
    const childUrl = seen.find((u) => u.includes("/childFolders"));
    expect(childUrl).toBeDefined();
    expect(childUrl).not.toContain("%24");
    expect(childUrl).toContain("$top=100");
    expect(childUrl).toContain("$select=id,displayName");
  });
});
