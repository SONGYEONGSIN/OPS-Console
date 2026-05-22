import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { sendGraphMail } from "../sendmail";
import { __resetTokenCache } from "../auth";

const ORIG_FETCH = global.fetch;
const ORIG_ENV = { ...process.env };

beforeEach(() => {
  __resetTokenCache();
  process.env.AZURE_AD_TENANT_ID = "tenant";
  process.env.AZURE_AD_CLIENT_ID = "client";
  process.env.AZURE_AD_CLIENT_SECRET = "secret";
});

afterEach(() => {
  global.fetch = ORIG_FETCH;
  process.env = { ...ORIG_ENV };
});

function mockTokenAndSend(opts: {
  sendStatus: number;
  sendBody?: string;
  messageId?: string;
}): ReturnType<typeof vi.fn> {
  const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.includes("login.microsoftonline.com")) {
      return new Response(
        JSON.stringify({ access_token: "tok", expires_in: 3600 }),
        { status: 200 },
      );
    }
    if (url.includes("graph.microsoft.com")) {
      const headers = new Headers();
      if (opts.messageId) {
        headers.set(
          "Location",
          `https://graph.microsoft.com/v1.0/users/x/messages/${opts.messageId}`,
        );
      }
      return new Response(opts.sendBody ?? "", {
        status: opts.sendStatus,
        headers,
      });
    }
    throw new Error(`unexpected url: ${url}`);
  });
  global.fetch = fetchMock as unknown as typeof fetch;
  return fetchMock;
}

describe("sendGraphMail", () => {
  it("200 — ok:true + messageId 반환", async () => {
    mockTokenAndSend({ sendStatus: 202, messageId: "abc-123" });

    const r = await sendGraphMail({
      senderUserId: "sender@org.com",
      toEmail: "receiver@school.ac.kr",
      subject: "Test",
      html: "<p>hi</p>",
    });

    expect(r.ok).toBe(true);
    if (r.ok) expect(r.messageId).toBe("abc-123");
  });

  it("401 — ok:false + error 'unauthorized'", async () => {
    mockTokenAndSend({ sendStatus: 401, sendBody: "auth required" });

    const r = await sendGraphMail({
      senderUserId: "sender@org.com",
      toEmail: "receiver@school.ac.kr",
      subject: "Test",
      html: "<p>hi</p>",
    });

    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain("unauthorized");
  });

  it("429 — ok:false + error 'rate_limited'", async () => {
    mockTokenAndSend({ sendStatus: 429, sendBody: "too many" });

    const r = await sendGraphMail({
      senderUserId: "sender@org.com",
      toEmail: "receiver@school.ac.kr",
      subject: "Test",
      html: "<p>hi</p>",
    });

    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain("rate_limited");
  });

  it("body 페이로드 형식 검증 — message.body.contentType=HTML + toRecipients + saveToSentItems", async () => {
    const fetchMock = mockTokenAndSend({ sendStatus: 202, messageId: "m" });

    await sendGraphMail({
      senderUserId: "sender@org.com",
      toEmail: "receiver@school.ac.kr",
      toName: "김교사",
      subject: "제목",
      html: "<p>본문</p>",
    });

    // 두 번째 호출이 sendMail (첫 번째는 token)
    const sendCall = fetchMock.mock.calls.find((c) =>
      String(c[0]).includes("graph.microsoft.com"),
    );
    expect(sendCall).toBeDefined();
    const init = sendCall![1] as RequestInit;
    expect(init.method).toBe("POST");
    const body = JSON.parse(String(init.body));
    expect(body.message.subject).toBe("제목");
    expect(body.message.body.contentType).toBe("HTML");
    expect(body.message.body.content).toContain("본문");
    expect(body.message.toRecipients[0].emailAddress.address).toBe(
      "receiver@school.ac.kr",
    );
    expect(body.message.toRecipients[0].emailAddress.name).toBe("김교사");
    expect(body.saveToSentItems).toBe(true);
  });

  it("text 지정 시 message.body.contentType=Text + content=text", async () => {
    const fetchMock = mockTokenAndSend({ sendStatus: 202, messageId: "m" });

    await sendGraphMail({
      senderUserId: "sender@org.com",
      toEmail: "receiver@school.ac.kr",
      subject: "제목",
      text: "안녕하세요\n평문 본문",
    });

    const sendCall = fetchMock.mock.calls.find((c) =>
      String(c[0]).includes("graph.microsoft.com"),
    );
    const init = sendCall![1] as RequestInit;
    const body = JSON.parse(String(init.body));
    expect(body.message.body.contentType).toBe("Text");
    expect(body.message.body.content).toBe("안녕하세요\n평문 본문");
  });
});
