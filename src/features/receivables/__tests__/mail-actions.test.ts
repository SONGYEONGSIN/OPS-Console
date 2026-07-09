import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

vi.mock("@/features/auth/queries", () => ({
  getCurrentOperator: vi.fn(),
}));

vi.mock("@/lib/microsoft/sendmail", () => ({
  sendGraphMail: vi.fn(),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(),
}));

vi.mock("@/lib/holidays/google-ical", () => ({
  fetchKoreanHolidays: vi.fn(),
}));

vi.mock("../queries", () => ({
  fetchReceivablesSheet: vi.fn(),
}));

vi.mock("../actions", () => ({
  markReceivablesMailSent: vi.fn(),
}));

import { getCurrentOperator } from "@/features/auth/queries";
import { sendGraphMail } from "@/lib/microsoft/sendmail";
import { createAdminClient } from "@/lib/supabase/admin";
import { fetchKoreanHolidays } from "@/lib/holidays/google-ical";
import { fetchReceivablesSheet } from "../queries";
import { markReceivablesMailSent } from "../actions";
import { sendReminderEmails } from "../mail-actions";
import type { ReceivablesSheet } from "../queries";

const ORIG_ENV = { ...process.env };
// 실발송 게이트(주말/공휴일) 통과용 — 평일(수) 고정
const WEEKDAY = new Date("2026-06-03T10:00:00+09:00");

const HEADERS = ["청구일자", "거래처명", "청구금액", "운영자", "학교담당자"];

/** 2026-05-22 → NOW(6/3) 기준 12일 경과 (threshold 10 통과) */
function mkSheet(
  rows: (string | number)[][],
  headers = HEADERS,
): ReceivablesSheet {
  return {
    worksheetName: "Sheet1",
    metaRows: [],
    headers,
    rows: rows.map((r) => [...r]),
    rowsText: rows.map((r) => r.map((c) => String(c))),
    validColIdx: headers.map((_, i) => i),
    headerRowNumber: 1,
    rowCount: rows.length + 1,
    columnCount: headers.length,
    fetchedAt: "2026-06-03T00:00:00Z",
  };
}

const SONG_ROW = ["2026-05-22", "A학교", 1_000_000, "송영신", "a@school.ac.kr"];
const HAN_ROW = ["2026-05-22", "B학교", 500_000, "한효진", "a@school.ac.kr"];
const UNMAPPED_ROW = [
  "2026-05-22",
  "C학교",
  700_000,
  "홍길둥",
  "a@school.ac.kr",
];

const bundleInput = {
  recipientEmail: "a@school.ac.kr",
  scope: "bundle" as const,
  dryRun: false,
};

/** operators 조회 + receivables_mail_sends insert 를 모두 지원하는 admin client mock */
function mockAdminClient(): { insert: ReturnType<typeof vi.fn> } {
  const insert = vi.fn().mockResolvedValue({ data: null, error: null });
  const operatorRows = [
    { id: "op-song", email: "ys1114@jinhakapply.com" },
    { id: "op-han", email: "hhj@jinhakapply.com" },
    { id: "op-admin", email: "admin@x.com" },
  ];
  const from = vi.fn().mockImplementation((table: string) => {
    if (table === "operators") {
      return {
        select: () => ({
          in: (_col: string, emails: string[]) =>
            Promise.resolve({
              data: operatorRows.filter((r) => emails.includes(r.email)),
              error: null,
            }),
          eq: (_col: string, email: string) => ({
            maybeSingle: () =>
              Promise.resolve({
                data: operatorRows.find((r) => r.email === email) ?? null,
                error: null,
              }),
          }),
        }),
      };
    }
    return { insert };
  });
  vi.mocked(createAdminClient).mockReturnValue({
    from,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any);
  return { insert };
}

function mockAdmin() {
  vi.mocked(getCurrentOperator).mockResolvedValue({
    email: "admin@x.com",
    displayName: "Admin K",
    permission: "admin",
    operator: null,
    role: "",
    team: null,
    allowedMenus: [],
  });
}

/** insert 로 넘어간 행들을 평탄화 */
function insertedRows(insert: ReturnType<typeof vi.fn>) {
  const arg = insert.mock.calls[0][0];
  return Array.isArray(arg) ? arg : [arg];
}

beforeEach(() => {
  vi.resetAllMocks();
  process.env.MAIL_COMPANY_NAME = "진학어플라이";
  delete process.env.MAIL_REMINDER_THRESHOLD_DAYS;
  vi.mocked(fetchKoreanHolidays).mockResolvedValue([]);
  vi.mocked(markReceivablesMailSent).mockResolvedValue({ ok: true });
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(WEEKDAY);
});

afterEach(() => {
  vi.useRealTimers();
  process.env = { ...ORIG_ENV };
});

describe("sendReminderEmails — 권한", () => {
  it("viewer 거부 + sendGraphMail 호출 0회", async () => {
    vi.mocked(getCurrentOperator).mockResolvedValue({
      email: "v@x.com",
      displayName: "Viewer",
      permission: "viewer",
      operator: null,
      role: "",
      team: null,
      allowedMenus: [],
    });
    const r = await sendReminderEmails(bundleInput);
    expect(r.ok).toBe(false);
    expect(vi.mocked(sendGraphMail).mock.calls.length).toBe(0);
  });

  it("member 거부 (admin only)", async () => {
    vi.mocked(getCurrentOperator).mockResolvedValue({
      email: "m@x.com",
      displayName: "Member",
      permission: "member",
      operator: null,
      role: "",
      team: null,
      allowedMenus: [],
    });
    const r = await sendReminderEmails(bundleInput);
    expect(r.ok).toBe(false);
    expect(vi.mocked(sendGraphMail).mock.calls.length).toBe(0);
  });

  it("로그인 안 됨 (null) 거부", async () => {
    vi.mocked(getCurrentOperator).mockResolvedValue(null);
    const r = await sendReminderEmails(bundleInput);
    expect(r.ok).toBe(false);
    expect(vi.mocked(sendGraphMail).mock.calls.length).toBe(0);
  });
});

describe("sendReminderEmails — 발신자는 담당 운영자", () => {
  it("발신 메일박스가 admin 이 아니라 담당 운영자 이메일", async () => {
    mockAdmin();
    mockAdminClient();
    vi.mocked(fetchReceivablesSheet).mockResolvedValue(mkSheet([SONG_ROW]));
    vi.mocked(sendGraphMail).mockResolvedValue({
      ok: true,
      messageId: "msg-1",
    });

    const r = await sendReminderEmails(bundleInput);
    expect(r.ok).toBe(true);
    expect(vi.mocked(sendGraphMail).mock.calls.length).toBe(1);
    const args = vi.mocked(sendGraphMail).mock.calls[0][0];
    expect(args.senderUserId).toBe("ys1114@jinhakapply.com");
    expect(args.senderUserId).not.toBe("admin@x.com");
    expect(args.toEmail).toBe("a@school.ac.kr");
  });

  it("운영자 2명 → 운영자별 2통 발송, 발신자가 서로 다름", async () => {
    mockAdmin();
    mockAdminClient();
    vi.mocked(fetchReceivablesSheet).mockResolvedValue(
      mkSheet([SONG_ROW, HAN_ROW]),
    );
    vi.mocked(sendGraphMail).mockResolvedValue({ ok: true, messageId: "m" });

    const r = await sendReminderEmails(bundleInput);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.sentCount).toBe(2);
    const senders = vi
      .mocked(sendGraphMail)
      .mock.calls.map((c) => c[0].senderUserId)
      .sort();
    expect(senders).toEqual(["hhj@jinhakapply.com", "ys1114@jinhakapply.com"]);
  });

  it("이력에 sender_operator_id=운영자, triggered_by=admin 기록", async () => {
    mockAdmin();
    const { insert } = mockAdminClient();
    vi.mocked(fetchReceivablesSheet).mockResolvedValue(mkSheet([SONG_ROW]));
    vi.mocked(sendGraphMail).mockResolvedValue({
      ok: true,
      messageId: "msg-1",
    });

    await sendReminderEmails(bundleInput);
    const row = insertedRows(insert)[0];
    expect(row.sender_operator_id).toBe("op-song");
    expect(row.triggered_by).toBe("op-admin");
    expect(row.status).toBe("sent");
  });
});

describe("sendReminderEmails — 매핑 실패는 그룹 단위 격리", () => {
  it("매핑 실패 행이 있어도 매핑된 운영자 그룹은 발송 + blockedCount 보고", async () => {
    mockAdmin();
    mockAdminClient();
    vi.mocked(fetchReceivablesSheet).mockResolvedValue(
      mkSheet([SONG_ROW, UNMAPPED_ROW]),
    );
    vi.mocked(sendGraphMail).mockResolvedValue({ ok: true, messageId: "m" });

    const r = await sendReminderEmails(bundleInput);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.sentCount).toBe(1);
      expect(r.blockedCount).toBe(1);
    }
    const args = vi.mocked(sendGraphMail).mock.calls[0][0];
    expect(args.senderUserId).toBe("ys1114@jinhakapply.com");
  });

  it("발송 가능한 그룹이 하나도 없으면 ok:false + sendGraphMail 0회", async () => {
    mockAdmin();
    mockAdminClient();
    vi.mocked(fetchReceivablesSheet).mockResolvedValue(mkSheet([UNMAPPED_ROW]));

    const r = await sendReminderEmails(bundleInput);
    expect(r.ok).toBe(false);
    expect(vi.mocked(sendGraphMail).mock.calls.length).toBe(0);
  });

  it("single scope 대상 행이 매핑 실패면 발송하지 않는다", async () => {
    mockAdmin();
    mockAdminClient();
    vi.mocked(fetchReceivablesSheet).mockResolvedValue(
      mkSheet([SONG_ROW, UNMAPPED_ROW]),
    );

    const r = await sendReminderEmails({
      recipientEmail: "a@school.ac.kr",
      scope: "single",
      customerName: "C학교",
      dryRun: false,
    });
    expect(r.ok).toBe(false);
    expect(vi.mocked(sendGraphMail).mock.calls.length).toBe(0);
  });
});

describe("sendReminderEmails — scope", () => {
  it("single scope → 지정 거래처 1건만, 해당 운영자 1통", async () => {
    mockAdmin();
    mockAdminClient();
    vi.mocked(fetchReceivablesSheet).mockResolvedValue(
      mkSheet([SONG_ROW, HAN_ROW]),
    );
    vi.mocked(sendGraphMail).mockResolvedValue({ ok: true, messageId: "m" });

    const r = await sendReminderEmails({
      recipientEmail: "a@school.ac.kr",
      scope: "single",
      customerName: "B학교",
      dryRun: false,
    });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.sentCount).toBe(1);
    const args = vi.mocked(sendGraphMail).mock.calls[0][0];
    expect(args.senderUserId).toBe("hhj@jinhakapply.com");
  });

  it("수신자가 시트에 없으면 ok:false — 클라이언트 임의 수신자 사칭 방지", async () => {
    mockAdmin();
    mockAdminClient();
    vi.mocked(fetchReceivablesSheet).mockResolvedValue(mkSheet([SONG_ROW]));

    const r = await sendReminderEmails({
      recipientEmail: "attacker@evil.com",
      scope: "bundle",
      dryRun: false,
    });
    expect(r.ok).toBe(false);
    expect(vi.mocked(sendGraphMail).mock.calls.length).toBe(0);
  });
});

describe("sendReminderEmails — dryRun / 게이트 / 실패", () => {
  it("dryRun=true → sendGraphMail 0회 + insert status=dry_run", async () => {
    mockAdmin();
    const { insert } = mockAdminClient();
    vi.mocked(fetchReceivablesSheet).mockResolvedValue(mkSheet([SONG_ROW]));

    const r = await sendReminderEmails({ ...bundleInput, dryRun: true });
    expect(r.ok).toBe(true);
    expect(vi.mocked(sendGraphMail).mock.calls.length).toBe(0);
    const row = insertedRows(insert)[0];
    expect(row.status).toBe("dry_run");
    expect(row.recipient_email).toBe("a@school.ac.kr");
    expect(row.sender_operator_id).toBe("op-song");
    expect(row.triggered_by).toBe("op-admin");
  });

  it("주말 실발송 → 차단(ok:false) + sendGraphMail 0회", async () => {
    mockAdmin();
    mockAdminClient();
    vi.mocked(fetchReceivablesSheet).mockResolvedValue(mkSheet([SONG_ROW]));
    vi.setSystemTime(new Date("2026-05-30T10:00:00+09:00")); // 토요일

    const r = await sendReminderEmails(bundleInput);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/주말|공휴일/);
    expect(vi.mocked(sendGraphMail).mock.calls.length).toBe(0);
  });

  it("주말이어도 dryRun=true는 허용", async () => {
    mockAdmin();
    mockAdminClient();
    // 토요일(5/30) 기준으로도 임계값 10일을 넘는 행이어야 그룹이 생긴다 (경과 20일)
    vi.mocked(fetchReceivablesSheet).mockResolvedValue(
      mkSheet([["2026-05-10", "A학교", 1_000_000, "송영신", "a@school.ac.kr"]]),
    );
    vi.setSystemTime(new Date("2026-05-30T10:00:00+09:00")); // 토요일

    const r = await sendReminderEmails({ ...bundleInput, dryRun: true });
    expect(r.ok).toBe(true);
  });

  it("Graph 실패 → insert status=failed + error_message 기록", async () => {
    mockAdmin();
    const { insert } = mockAdminClient();
    vi.mocked(fetchReceivablesSheet).mockResolvedValue(mkSheet([SONG_ROW]));
    vi.mocked(sendGraphMail).mockResolvedValue({
      ok: false,
      error: "unauthorized: token denied",
    });

    const r = await sendReminderEmails(bundleInput);
    expect(r.ok).toBe(true); // 그룹별 status 개별 기록
    const row = insertedRows(insert)[0];
    expect(row.status).toBe("failed");
    expect(row.error_message).toContain("unauthorized");
  });

  it("시트를 못 읽으면 ok:false", async () => {
    mockAdmin();
    mockAdminClient();
    vi.mocked(fetchReceivablesSheet).mockResolvedValue(null);

    const r = await sendReminderEmails(bundleInput);
    expect(r.ok).toBe(false);
  });
});

describe("sendReminderEmails — 메일발송일자 기록", () => {
  it("발송 성공 행만 PATCH — 재조회 없이 send 루프의 excelRow 사용", async () => {
    mockAdmin();
    mockAdminClient();
    const headers = [...HEADERS, "메일발송일자"];
    vi.mocked(fetchReceivablesSheet).mockResolvedValue(
      mkSheet([[...SONG_ROW, ""]], headers),
    );
    vi.mocked(sendGraphMail).mockResolvedValue({ ok: true, messageId: "m" });

    await sendReminderEmails(bundleInput);
    expect(vi.mocked(markReceivablesMailSent)).toHaveBeenCalledTimes(1);
    const [, colIdx, rows] = vi.mocked(markReceivablesMailSent).mock.calls[0];
    expect(colIdx).toBe(5); // '메일발송일자' 컬럼
    expect(rows).toEqual([2]); // headerRowNumber(1) + 1 + index(0)
  });

  it("dryRun 이면 PATCH 하지 않는다", async () => {
    mockAdmin();
    mockAdminClient();
    vi.mocked(fetchReceivablesSheet).mockResolvedValue(
      mkSheet([[...SONG_ROW, ""]], [...HEADERS, "메일발송일자"]),
    );

    await sendReminderEmails({ ...bundleInput, dryRun: true });
    expect(vi.mocked(markReceivablesMailSent)).not.toHaveBeenCalled();
  });
});

describe("sendReminderEmails — 입력 검증", () => {
  it("recipientEmail 형식 오류 거부", async () => {
    const r = await sendReminderEmails({
      recipientEmail: "not-an-email",
      scope: "bundle",
      dryRun: false,
    });
    expect(r.ok).toBe(false);
  });

  it("single scope 인데 customerName 누락 거부", async () => {
    const r = await sendReminderEmails({
      recipientEmail: "a@school.ac.kr",
      scope: "single",
      dryRun: false,
    } as never);
    expect(r.ok).toBe(false);
  });
});
