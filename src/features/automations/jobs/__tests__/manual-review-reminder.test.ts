import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ManualSource } from "@/features/manual-ledger/types";

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(() => ({})),
}));
vi.mock("@/lib/microsoft/sendmail", () => ({ sendGraphMail: vi.fn() }));
vi.mock("@/lib/holidays/google-ical", () => ({
  fetchKoreanHolidays: vi.fn(),
}));
vi.mock("@/features/manual-ledger/source", async () => {
  const actual = await vi.importActual<
    typeof import("@/features/manual-ledger/source")
  >("@/features/manual-ledger/source");
  return { ...actual, fetchManualSource: vi.fn() };
});
vi.mock("@/features/manual-ledger/operators", () => ({
  loadOperatorDirectory: vi.fn(),
}));
vi.mock("@/features/manual-review/store", async () => {
  const actual = await vi.importActual<
    typeof import("@/features/manual-review/store")
  >("@/features/manual-review/store");
  return { ...actual, loadSentKeys: vi.fn(), saveReminder: vi.fn() };
});

import { fetchKoreanHolidays } from "@/lib/holidays/google-ical";
import { sendGraphMail } from "@/lib/microsoft/sendmail";
import { ManualSourceError } from "@/features/manual-ledger/parse";
import { fetchManualSource } from "@/features/manual-ledger/source";
import { loadOperatorDirectory } from "@/features/manual-ledger/operators";
import { loadSentKeys, saveReminder } from "@/features/manual-review/store";
import type { AutomationRunResult } from "../../types";
import { runManualReviewReminder } from "../manual-review-reminder";

const send = vi.mocked(sendGraphMail);
const save = vi.mocked(saveReminder);
const sentKeys = vi.mocked(loadSentKeys);
const source = vi.mocked(fetchManualSource);

const SEND_DAY = new Date("2026-08-03T01:00:00Z"); // 월요일
const ADM1 = "adm1@example.test";
const ADM2 = "adm2@example.test";
const SUM1 = "__summary__:" + ADM1;
const SUM2 = "__summary__:" + ADM2;

const ledgerRow = (task: string, docName: string, owner: string) => ({
  code: null,
  task,
  docName,
  ownerText: owner,
  owners: [owner],
  lastModified: "2026.03.02",
});

const folderFile = (id: string, name: string) => ({
  id,
  name,
  webUrl: "https://example.test/" + id,
  lastModifiedDateTime: null,
  cTag: null,
});

const fixture = (): ManualSource => ({
  ledger: [
    ledgerRow("원서접수", "A01. 매뉴얼.docx", "담당자A"),
    ledgerRow("원서접수", "A02. 매뉴얼.docx", "담당자B"),
    ledgerRow("구사업", "X01. 매뉴얼.docx", "담당자A"),
  ],
  activeTasks: new Set(["원서접수"]),
  files: [
    folderFile("f1", "A01. 매뉴얼.docx"),
    folderFile("f2", "A02. 매뉴얼.docx"),
  ],
});

const noPii = (r: AutomationRunResult) =>
  expect(
    JSON.stringify({ message: r.message, details: r.details }),
  ).not.toContain("@");

const mailsTo = (email: string) =>
  send.mock.calls.map((c) => c[0]).filter((a) => a.toEmail === email);

beforeEach(() => {
  vi.resetAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => undefined);
  vi.stubEnv("SHAREPOINT_DRIVE_ID", "drive1");
  vi.stubEnv("SHAREPOINT_MANUAL_ITEM_ID", "folderX");
  vi.stubEnv("SHAREPOINT_MANUAL_LEDGER_ITEM_ID", "ledgerX");
  vi.stubEnv("MANUAL_EDIT_ADMIN_EMAILS", `${ADM1},${ADM2}`);
  vi.stubEnv("MAIL_DRY_RUN", "");
  vi.mocked(fetchKoreanHolidays).mockResolvedValue([]);
  source.mockResolvedValue(fixture());
  vi.mocked(loadOperatorDirectory).mockResolvedValue([
    { name: "담당자A", email: "a@example.test", status: "active" },
    { name: "담당자B", email: "b@example.test", status: "active" },
  ]);
  sentKeys.mockResolvedValue(new Set());
  save.mockResolvedValue(undefined);
  send.mockResolvedValue({ ok: true, messageId: "m1" });
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("보내는 날이 아니면 건너뛴다", () => {
  it("3월·8월이 아니면 스킵 — 원천도 안 읽는다", async () => {
    const r = await runManualReviewReminder(new Date("2026-11-09T01:00:00Z"));
    expect(r).toMatchObject({ ok: true, skipped: true });
    expect(source).not.toHaveBeenCalled();
    noPii(r);
  });

  it("8월이라도 주말이면 스킵", async () => {
    const r = await runManualReviewReminder(new Date("2026-08-01T01:00:00Z"));
    expect(r).toMatchObject({ ok: true, skipped: true });
    expect(source).not.toHaveBeenCalled();
  });

  it("3월 1일(공휴일)은 스킵", async () => {
    vi.mocked(fetchKoreanHolidays).mockResolvedValue([
      { date: "2027-03-01", title: "삼일절" },
    ]);
    const r = await runManualReviewReminder(new Date("2027-03-01T01:00:00Z"));
    expect(r).toMatchObject({ ok: true, skipped: true });
    expect(source).not.toHaveBeenCalled();
  });

  it("공휴일 목록을 못 받아도(빈 목록) 3월 1일은 스킵", async () => {
    vi.mocked(fetchKoreanHolidays).mockResolvedValue([]);
    const r = await runManualReviewReminder(new Date("2027-03-01T01:00:00Z"));
    expect(r).toMatchObject({ ok: true, skipped: true });
    expect(source).not.toHaveBeenCalled();
  });

  it("공휴일 목록이 비어도 3월 2일은 보낸다", async () => {
    vi.mocked(fetchKoreanHolidays).mockResolvedValue([]);
    const r = await runManualReviewReminder(new Date("2027-03-02T01:00:00Z"));
    expect(r.skipped).toBeFalsy();
    expect(source).toHaveBeenCalled();
  });
});

describe("설정·원천", () => {
  it("관리자 메일이 없으면 실패", async () => {
    vi.stubEnv("MANUAL_EDIT_ADMIN_EMAILS", "");
    const r = await runManualReviewReminder(SEND_DAY);
    expect(r.ok).toBe(false);
    expect(r.message).toContain("MANUAL_EDIT_ADMIN_EMAILS");
    expect(source).not.toHaveBeenCalled();
  });

  it("관리자 메일 중 하나라도 형식이 틀리면 실패", async () => {
    vi.stubEnv("MANUAL_EDIT_ADMIN_EMAILS", `${ADM1},not-mail`);
    const r = await runManualReviewReminder(SEND_DAY);
    expect(r.ok).toBe(false);
    expect(r.message).toContain("MANUAL_EDIT_ADMIN_EMAILS");
    expect(source).not.toHaveBeenCalled();
    noPii(r);
  });

  it("대장에 없는 진행 업무·업무 칸 빈 문서를 요약과 details 에 싣는다", async () => {
    source.mockResolvedValue({
      ...fixture(),
      ledger: [
        ...fixture().ledger,
        { ...fixture().ledger[0], task: "", docName: "Z09. 업무 빈칸.docx" },
      ],
      activeTasks: new Set(["원서접수", "새이름업무"]),
    });
    const r = await runManualReviewReminder(SEND_DAY);
    expect(mailsTo(ADM1)[0].html).toContain("진행 중인데 대장에 없는 업무 1건");
    expect(mailsTo(ADM1)[0].html).toContain("업무 칸이 빈 문서 1건");
    expect(r.details).toMatchObject({ missingTasks: 1, untasked: 1 });
    noPii(r);
  });

  it("원천 읽기 실패는 그 메시지로 실패하고 아무것도 안 보낸다", async () => {
    source.mockRejectedValue(
      new ManualSourceError("매뉴얼 대장 읽기 실패 (500)"),
    );
    const r = await runManualReviewReminder(SEND_DAY);
    expect(r).toMatchObject({
      ok: false,
      message: "매뉴얼 대장 읽기 실패 (500)",
    });
    expect(send).not.toHaveBeenCalled();
  });

  it("기록 저장이 실패하면 멈추고 실패로 끝난다", async () => {
    save.mockRejectedValue(new Error("db down"));
    const r = await runManualReviewReminder(SEND_DAY);
    expect(r.ok).toBe(false);
    expect(send).toHaveBeenCalledTimes(1);
    noPii(r);
  });
});

describe("반기 첫 발송", () => {
  it("담당자마다 본인 메일함에서 본인에게, 관리자 요약도 각자에게", async () => {
    const r = await runManualReviewReminder(SEND_DAY);
    expect(send).toHaveBeenCalledTimes(4);
    for (const call of send.mock.calls) {
      expect(call[0].senderUserId).toBe(call[0].toEmail);
    }
    const [toA] = mailsTo("a@example.test");
    expect(toA.subject).toBe("[운영부] 매뉴얼 점검 안내 — 1·2분기(4~9월)");
    expect(toA.html).toContain("A01. 매뉴얼.docx");
    expect(toA.html).not.toContain("X01. 매뉴얼.docx");
    expect(mailsTo(ADM1)).toHaveLength(1);
    expect(mailsTo(ADM2)).toHaveLength(1);
    expect(save).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        half_key: "2026-H1",
        recipient_key: "a@example.test",
        status: "sent",
        manual_count: 1,
      }),
    );
    expect(save).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ recipient_key: SUM1, status: "sent" }),
    );
    expect(r.ok).toBe(true);
    expect(r.details).toMatchObject({
      recipients: 2,
      sent: 2,
      summarySent: 2,
      manuals: 2,
    });
    noPii(r);
  });
});

describe("같은 반기 다음 호출", () => {
  it("이미 보낸 사람·요약은 건너뛰고 남은 사람에게만 보낸다", async () => {
    sentKeys.mockResolvedValue(new Set(["a@example.test", SUM1, SUM2]));
    const r = await runManualReviewReminder(SEND_DAY);
    expect(send).toHaveBeenCalledTimes(1);
    expect(send.mock.calls[0][0].toEmail).toBe("b@example.test");
    expect(r.details).toMatchObject({ sent: 1, skipped: 1, summarySent: 0 });
  });

  it("모두 보냈으면 아무것도 안 보낸다", async () => {
    sentKeys.mockResolvedValue(
      new Set(["a@example.test", "b@example.test", SUM1, SUM2]),
    );
    const r = await runManualReviewReminder(SEND_DAY);
    expect(send).not.toHaveBeenCalled();
    expect(r.ok).toBe(true);
    expect(r.details).toMatchObject({ sent: 0, skipped: 2 });
  });
});

describe("실패", () => {
  it("한 사람이 실패해도 나머지와 요약은 나가고, 실패는 코드만 남는다", async () => {
    send.mockImplementation(async (args) =>
      args.toEmail === "b@example.test"
        ? { ok: false, error: "throttled: b@example.test 본문" }
        : { ok: true, messageId: "m" },
    );
    const r = await runManualReviewReminder(SEND_DAY);
    expect(save).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        recipient_key: "b@example.test",
        status: "failed",
        error: "throttled",
      }),
    );
    expect(mailsTo(ADM1)[0].html).toContain("아직 못 보낸 담당자 1명");
    expect(r.ok).toBe(false);
    expect(r.details).toMatchObject({ sent: 1, failed: 1, summarySent: 2 });
    noPii(r);
  });
});

describe("DRY-RUN", () => {
  it("메일을 보내지 않고 dry_run 으로만 남긴다", async () => {
    vi.stubEnv("MAIL_DRY_RUN", "true");
    const r = await runManualReviewReminder(SEND_DAY);
    expect(send).not.toHaveBeenCalled();
    expect(save).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        recipient_key: "a@example.test",
        status: "dry_run",
      }),
    );
    expect(r.message.startsWith("[DRY-RUN]")).toBe(true);
    expect(r.ok).toBe(true);
    noPii(r);
  });
});
