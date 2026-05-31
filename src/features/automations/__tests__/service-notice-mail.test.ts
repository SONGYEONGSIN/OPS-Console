import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockCanSendOn, mockFetchHolidays, mockFetchServices, mockSend } =
  vi.hoisted(() => ({
    mockCanSendOn: vi.fn(),
    mockFetchHolidays: vi.fn(),
    mockFetchServices: vi.fn(),
    mockSend: vi.fn(),
  }));

vi.mock("@/features/receivables/mail-schedule", () => ({
  canSendOn: mockCanSendOn,
}));
vi.mock("@/lib/holidays/google-ical", () => ({
  fetchKoreanHolidays: mockFetchHolidays,
}));
vi.mock("@/features/service-notice/queries", () => ({
  fetchNextMonthServices: mockFetchServices,
}));
vi.mock("@/features/service-notice/mail-actions", () => ({
  sendServiceNotices: mockSend,
}));

import { runServiceNoticeMail } from "../jobs/service-notice-mail";

const svc = (email: string) => ({
  id: "1",
  universityName: "가천대",
  serviceName: "수시",
  universityType: "4년제",
  category: "공통원서",
  operatorEmail: email,
  operatorName: "김운영",
  writeStartAt: "2026-06-01T00:00:00Z",
  writeEndAt: null,
  payStartAt: null,
  payEndAt: null,
});

beforeEach(() => {
  vi.clearAllMocks();
  mockFetchHolidays.mockResolvedValue([]);
});

describe("runServiceNoticeMail", () => {
  it("주말·공휴일이면 발송 안 함", async () => {
    mockCanSendOn.mockReturnValue(false);
    const r = await runServiceNoticeMail();
    expect(r.ok).toBe(true);
    expect(r.message).toContain("주말·공휴일");
    expect(mockFetchServices).not.toHaveBeenCalled();
  });

  it("대상 서비스 없으면 발송 없음", async () => {
    mockCanSendOn.mockReturnValue(true);
    mockFetchServices.mockResolvedValue([]);
    const r = await runServiceNoticeMail();
    expect(r.ok).toBe(true);
    expect(r.message).toContain("서비스 없음");
    expect(mockSend).not.toHaveBeenCalled();
  });

  it("운영자 그룹 발송 → sendServiceNotices 호출 + 요약", async () => {
    mockCanSendOn.mockReturnValue(true);
    mockFetchServices.mockResolvedValue([svc("a@x.com"), svc("b@x.com")]);
    mockSend.mockResolvedValue({ sent: 2, failed: 0, dryRun: 0, skipped: 0 });
    const r = await runServiceNoticeMail();
    expect(mockSend).toHaveBeenCalledTimes(1);
    expect(r.ok).toBe(true);
    expect(r.details).toMatchObject({ groups: 2, sent: 2 });
  });
});
