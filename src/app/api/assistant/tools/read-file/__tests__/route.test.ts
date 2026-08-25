import { describe, it, expect, vi, beforeEach } from "vitest";

const state = {
  item: null as Record<string, unknown> | null,
  pdfLocation: "https://dl.example/x.pdf" as string | null,
  itemStatus: 200,
};

vi.mock("@/lib/microsoft/auth", () => ({
  getGraphToken: () => Promise.resolve("tok"),
}));

vi.stubGlobal(
  "fetch",
  vi.fn((url: string) => {
    // 메타 조회와 내려받기 주소를 가른다 — 둘 다 /driveItem 이 들어 있다.
    if (!String(url).includes("/content")) {
      return Promise.resolve({
        ok: state.itemStatus === 200,
        status: state.itemStatus,
        json: () => Promise.resolve(state.item),
        text: () => Promise.resolve("err"),
      });
    }
    // content 는 302 로 임시 주소를 준다.
    return Promise.resolve({
      status: state.pdfLocation ? 302 : 500,
      headers: { get: (h: string) => (h === "location" ? state.pdfLocation : null) },
      text: () => Promise.resolve("err"),
      ok: false,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);
  }),
);

const { POST } = await import("../route");

const post = (body: unknown, auth = "Bearer s3cret") =>
  new Request("http://x/api/assistant/tools/read-file", {
    method: "POST",
    headers: { authorization: auth },
    body: JSON.stringify(body),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  }) as any;

const LINK = "https://tenant.sharepoint.com/sites/운영부/보고서.docx";

describe("파일 읽기 도구", () => {
  beforeEach(() => {
    vi.mocked(fetch).mockClear();
    process.env.CRON_SECRET = "s3cret";
    state.itemStatus = 200;
    state.pdfLocation = "https://dl.example/x.pdf";
    state.item = {
      name: "보고서.docx",
      size: 12345,
      file: { mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" },
      webUrl: LINK,
    };
  });

  it("CRON_SECRET이 틀리면 401", async () => {
    expect((await POST(post({ url: LINK }, "Bearer no"))).status).toBe(401);
  });

  it("파일 이름과 내려받을 주소를 준다", async () => {
    const body = await (await POST(post({ url: LINK }))).json();
    expect(body.name).toBe("보고서.docx");
    expect(body.downloadUrl).toBe("https://dl.example/x.pdf");
  });

  it("사내 링크가 아니면 400 — 남의 파일을 끌어오지 않는다", async () => {
    const res = await POST(post({ url: "https://evil.example.com/a.docx" }));
    expect(res.status).toBe(400);
  });

  it("없는 파일이면 404 — 권한이 없어도 여기로 온다", async () => {
    state.itemStatus = 404;
    expect((await POST(post({ url: LINK }))).status).toBe(404);
  });

  it("너무 큰 파일은 거절한다 — 통째로 읽히면 답이 흐려지고 오래 걸린다", async () => {
    state.item = { ...state.item, size: 80 * 1024 * 1024 };
    const res = await POST(post({ url: LINK }));
    expect(res.status).toBe(413);
  });

  it("PDF 변환 주소를 못 받으면 502 — 조용히 빈 값을 주지 않는다", async () => {
    state.pdfLocation = null;
    expect((await POST(post({ url: LINK }))).status).toBe(502);
  });

  it("이미 PDF면 변환을 시키지 않는다 — 변환 서비스가 PDF 입력을 406으로 거절한다", async () => {
    state.item = {
      name: "통합 규정집.pdf",
      size: 6_234_909,
      file: { mimeType: "application/pdf" },
      webUrl: LINK,
    };
    const body = await (await POST(post({ url: LINK }))).json();
    expect(body.ok).toBe(true);
    expect(body.downloadUrl).toBe("https://dl.example/x.pdf");
    const called = vi.mocked(fetch).mock.calls.map((c) => String(c[0]));
    expect(called.some((u) => u.includes("format=pdf"))).toBe(false);
  });

  it("어떤 형식이었는지 알려준다 — 엑셀이면 요약이 약하다고 말해야 한다", async () => {
    const body = await (await POST(post({ url: LINK }))).json();
    expect(body.mimeType).toContain("wordprocessingml");
  });
});
