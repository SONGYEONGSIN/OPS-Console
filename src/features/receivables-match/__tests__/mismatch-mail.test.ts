import { describe, it, expect, vi, beforeEach } from "vitest";
import type { MismatchPair } from "../types";

const { sendGraphMailMock } = vi.hoisted(() => ({
  sendGraphMailMock: vi.fn(),
}));

vi.mock("@/lib/microsoft/sendmail", () => ({
  sendGraphMail: sendGraphMailMock,
}));

import { sendMismatchReport } from "../mismatch-mail";

const sample: MismatchPair[] = [
  {
    misuRow: 5,
    depRow: 2,
    amount: 100000,
    misuCustomer: "가천대",
    depContent: "동국대",
    misuDate: "2026-04-10",
    depDate: "2026-04-15",
  },
];

beforeEach(() => {
  sendGraphMailMock.mockReset();
});

describe("sendMismatchReport", () => {
  it("빈 배열 → sendGraphMail 미호출 + skipped 반환", async () => {
    const result = await sendMismatchReport([], { dryRun: false });
    expect(sendGraphMailMock).not.toHaveBeenCalled();
    expect(result).toEqual({ ok: true, count: 0, skipped: true });
  });

  it("dryRun=true → sendGraphMail 미호출 + ok+dryRun true", async () => {
    const result = await sendMismatchReport(sample, { dryRun: true });
    expect(sendGraphMailMock).not.toHaveBeenCalled();
    expect(result.ok).toBe(true);
    expect(result.dryRun).toBe(true);
    expect(result.count).toBe(1);
  });

  it("dryRun=false → admin(ys1114) 메일 발송 + HTML에 거래처/금액/날짜 포함", async () => {
    sendGraphMailMock.mockResolvedValue({ ok: true, messageId: "id-1" });
    const result = await sendMismatchReport(sample, { dryRun: false });
    expect(sendGraphMailMock).toHaveBeenCalledOnce();
    const args = sendGraphMailMock.mock.calls[0][0];
    expect(args.toEmail).toBe("ys1114@jinhakapply.com");
    expect(args.subject).toMatch(/금액일치|불일치|mismatch/i);
    expect(args.html).toContain("가천대");
    expect(args.html).toContain("동국대");
    expect(args.html).toContain("100,000");
    // 브랜드 통일: 푸터는 운영부 상황실, OPS-Console 미노출
    expect(args.html).toContain("본 알림 메일은 운영부 상황실에서 자동 발송되었습니다.");
    expect(args.html).not.toContain("OPS-Console");
    expect(result.ok).toBe(true);
  });
});
