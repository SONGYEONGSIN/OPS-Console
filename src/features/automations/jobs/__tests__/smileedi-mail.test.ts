import { describe, it, expect, vi, beforeEach } from "vitest";

// Graph/DB 의존 모듈 모킹 — 잡의 분기 로직만 검증
vi.mock("@/features/smileedi/queries", () => ({
  fetchSmileEdiSheet: vi.fn(),
}));
vi.mock("@/features/smileedi/mail-actions", () => ({
  sendSmileEdiMails: vi.fn(),
}));

import { runSmileEdiMail } from "../smileedi-mail";
import { fetchSmileEdiSheet } from "@/features/smileedi/queries";

const ENV_KEYS = [
  "SMILEEDI_ITEM_KEYWORDS",
  "SMILEEDI_MANAGER_EMAIL_MAP",
  "SMILEEDI_DEFAULT_MANAGER",
];

describe("runSmileEdiMail — 분기", () => {
  beforeEach(() => {
    for (const k of ENV_KEYS) delete process.env[k];
    vi.clearAllMocks();
  });

  it("config 누락 → ok:false + 안내 메시지", async () => {
    const r = await runSmileEdiMail();
    expect(r.ok).toBe(false);
    expect(r.message).toContain("환경변수 누락");
  });

  it("config 있으나 시트 미연결 → ok:false", async () => {
    process.env.SMILEEDI_ITEM_KEYWORDS = "수수료";
    process.env.SMILEEDI_MANAGER_EMAIL_MAP = "송영신:song@x.com";
    process.env.SMILEEDI_DEFAULT_MANAGER = "송영신";
    vi.mocked(fetchSmileEdiSheet).mockResolvedValue(null);

    const r = await runSmileEdiMail();
    expect(r.ok).toBe(false);
    expect(r.message).toContain("시트");
  });
});
