import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../auth", () => ({ getGraphToken: vi.fn().mockResolvedValue("tok") }));

import { getInboxMessages } from "../mail-read";

const okBody = {
  value: [
    {
      id: "AAMkAD1",
      subject: "견적 문의",
      bodyPreview: "안녕하세요",
      body: { content: "<p>본문</p>", contentType: "html" },
      from: { emailAddress: { name: "김민수", address: "kim@u.ac.kr" } },
      receivedDateTime: "2026-06-22T00:12:00Z",
      isRead: false,
    },
  ],
};

beforeEach(() => vi.restoreAllMocks());

describe("getInboxMessages", () => {
  it("200 응답을 정규화 배열로 반환", async () => {
    const fetchMock = vi
      .spyOn(global, "fetch")
      .mockResolvedValue(
        new Response(JSON.stringify(okBody), { status: 200 }),
      );
    const r = await getInboxMessages("op@x.com");
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.messages).toHaveLength(1);
      expect(r.messages[0].graphMessageId).toBe("AAMkAD1");
      expect(r.messages[0].fromEmail).toBe("kim@u.ac.kr");
    }
    // mailFolders/inbox/messages 경로 + owner 인코딩 확인
    const calledUrl = fetchMock.mock.calls[0][0] as string;
    expect(calledUrl).toContain(
      "/users/op%40x.com/mailFolders/inbox/messages",
    );
  });

  it("since 지정 시 $filter receivedDateTime gt 포함 (리터럴 $ + %20 공백)", async () => {
    const fetchMock = vi
      .spyOn(global, "fetch")
      .mockResolvedValue(new Response(JSON.stringify(okBody), { status: 200 }));
    await getInboxMessages("op@x.com", "2026-06-21T00:00:00Z");
    const calledUrl = fetchMock.mock.calls[0][0] as string;
    // OData 키는 리터럴 $, 공백은 %20, since 값은 encodeURIComponent 결과
    expect(calledUrl).toContain("$filter=receivedDateTime%20gt%20");
    expect(calledUrl).toContain(encodeURIComponent("2026-06-21T00:00:00Z"));
  });

  it("401은 unauthorized 에러 키", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue(
      new Response("nope", { status: 401 }),
    );
    const r = await getInboxMessages("op@x.com");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/^unauthorized/);
  });
});
