import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type {
  NoticeRow,
  RequestItem,
} from "@/features/sms-sender/request-notify/types";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(() => ({})),
}));
vi.mock("@/lib/microsoft/sendmail", () => ({ sendGraphMail: vi.fn() }));
vi.mock("@/features/sms-sender/request-notify/list-source", async () => {
  const actual = await vi.importActual<
    typeof import("@/features/sms-sender/request-notify/list-source")
  >("@/features/sms-sender/request-notify/list-source");
  return { ...actual, fetchRequestItems: vi.fn() };
});
vi.mock("@/features/sms-sender/request-notify/store", () => ({
  loadNoticeRows: vi.fn(),
  insertNoticeRows: vi.fn(),
  updateLastStatus: vi.fn(),
  applyRecoveries: vi.fn(),
  claimNotice: vi.fn(),
  finishNotice: vi.fn(),
}));

import { sendGraphMail } from "@/lib/microsoft/sendmail";
import {
  RequestListError,
  fetchRequestItems,
} from "@/features/sms-sender/request-notify/list-source";
import * as store from "@/features/sms-sender/request-notify/store";
import { AUTOMATION_JOBS } from "../../registry";
import { runSmsSenderRequestNotify } from "../sms-sender-request-notify";

const MANAGER = "manager@example.test";
const APPLICANT = "applicant@example.test";

function item(over: Partial<RequestItem> = {}): RequestItem {
  return {
    id: "1",
    status: "요청",
    university: "가나대학교",
    kind: "수시",
    serviceId: "100",
    title: "t",
    applicantEmail: APPLICANT,
    applicantName: "신청자",
    webUrl: null,
    ...over,
  };
}

function row(over: Partial<NoticeRow> = {}): NoticeRow {
  return {
    item_id: "9",
    last_status: "요청",
    new_state: "sent",
    new_attempts: 1,
    new_claimed_at: null,
    done_state: "pending",
    done_attempts: 0,
    done_claimed_at: null,
    ...over,
  };
}

const sent = vi.mocked(sendGraphMail);
const s = vi.mocked(store);

beforeEach(() => {
  vi.resetAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => undefined);
  process.env.SHAREPOINT_SMS_REQUEST_SITE_ID = "site";
  process.env.SHAREPOINT_SMS_REQUEST_LIST_ID = "list";
  process.env.SMS_SENDER_REQUEST_MANAGER_EMAIL = MANAGER;
  delete process.env.MAIL_DRY_RUN;
  s.loadNoticeRows.mockResolvedValue([row({ item_id: "other" })]);
  s.claimNotice.mockResolvedValue(true);
  s.finishNotice.mockResolvedValue(true);
  sent.mockResolvedValue({ ok: true, messageId: "m" });
});

afterEach(() => {
  delete process.env.SHAREPOINT_SMS_REQUEST_SITE_ID;
  delete process.env.SHAREPOINT_SMS_REQUEST_LIST_ID;
  delete process.env.SMS_SENDER_REQUEST_MANAGER_EMAIL;
  delete process.env.MAIL_DRY_RUN;
});

function listReturns(items: RequestItem[], malformed = 0) {
  vi.mocked(fetchRequestItems).mockResolvedValue({ items, malformed });
}

describe("runSmsSenderRequestNotify", () => {
  it("env 하나라도 없으면 ok:false, 이름을 적고 Graph 를 안 부른다", async () => {
    delete process.env.SMS_SENDER_REQUEST_MANAGER_EMAIL;
    const r = await runSmsSenderRequestNotify();
    expect(r.ok).toBe(false);
    expect(r.message).toContain(
      "환경변수 없음: SMS_SENDER_REQUEST_MANAGER_EMAIL",
    );
    expect(fetchRequestItems).not.toHaveBeenCalled();
    expect(sent).not.toHaveBeenCalled();
  });

  it("스냅샷이 비면 seed 만 하고 메일 0통", async () => {
    s.loadNoticeRows.mockResolvedValue([]);
    listReturns(Array.from({ length: 32 }, (_, i) => item({ id: String(i) })));
    const r = await runSmsSenderRequestNotify();
    expect(r.ok).toBe(true);
    expect(r.message).toBe("처음 실행 — 기존 32행 적재, 발송 없음");
    expect(s.insertNoticeRows).toHaveBeenCalledTimes(1);
    expect(sent).not.toHaveBeenCalled();
  });

  it("새 행 → 매니저 메일함에서 매니저에게", async () => {
    listReturns([item()]);
    const r = await runSmsSenderRequestNotify();
    expect(sent).toHaveBeenCalledTimes(1);
    const arg = sent.mock.calls[0][0];
    expect(arg.senderUserId).toBe(MANAGER);
    expect(arg.toEmail).toBe(MANAGER);
    expect(r.message).toBe("신규 1건 알림 · 완료 0건 알림");
    expect(r.details).toEqual({
      items: 1,
      newSent: 1,
      doneSent: 0,
      failed: 0,
      malformed: 0,
    });
  });

  it("완료 전환 → 매니저 메일함에서 신청자에게", async () => {
    s.loadNoticeRows.mockResolvedValue([row({ item_id: "1" })]);
    listReturns([item({ status: "완료" })]);
    const r = await runSmsSenderRequestNotify();
    expect(sent).toHaveBeenCalledTimes(1);
    expect(sent.mock.calls[0][0].senderUserId).toBe(MANAGER);
    expect(sent.mock.calls[0][0].toEmail).toBe(APPLICANT);
    expect(r.details?.doneSent).toBe(1);
    expect(s.updateLastStatus).toHaveBeenCalled();
  });

  it("처음 보이는 완료 행은 new 메일 다음 done 메일", async () => {
    listReturns([item({ status: "완료" })]);
    await runSmsSenderRequestNotify();
    expect(sent.mock.calls.map((c) => c[0].toEmail)).toEqual([
      MANAGER,
      APPLICANT,
    ]);
  });

  it("신청자 메일이 없으면 Graph 호출 없이 failed, ok:false", async () => {
    s.loadNoticeRows.mockResolvedValue([row({ item_id: "1" })]);
    listReturns([item({ status: "완료", applicantEmail: null })]);
    const r = await runSmsSenderRequestNotify();
    expect(sent).not.toHaveBeenCalled();
    expect(s.finishNotice).toHaveBeenCalledWith(
      expect.anything(),
      "1",
      "done",
      expect.objectContaining({ state: "failed", error: "신청자 메일 없음" }),
    );
    expect(r.ok).toBe(false);
    expect(r.details?.failed).toBe(1);
  });

  it("claim 을 놓치면 보내지 않고 실패로 세지 않는다", async () => {
    s.claimNotice.mockResolvedValue(false);
    listReturns([item()]);
    const r = await runSmsSenderRequestNotify();
    expect(sent).not.toHaveBeenCalled();
    expect(s.finishNotice).not.toHaveBeenCalled();
    expect(r.ok).toBe(true);
    expect(r.details?.failed).toBe(0);
  });

  it("finishNotice 가 false 면 실패로 센다", async () => {
    s.finishNotice.mockResolvedValue(false);
    listReturns([item()]);
    const r = await runSmsSenderRequestNotify();
    expect(r.ok).toBe(false);
    expect(r.details?.failed).toBe(1);
  });

  it("MAIL_DRY_RUN=true 면 sendGraphMail 0회, dry_run, [DRY-RUN] 시작", async () => {
    process.env.MAIL_DRY_RUN = "true";
    listReturns([item()]);
    const r = await runSmsSenderRequestNotify();
    expect(sent).not.toHaveBeenCalled();
    expect(s.finishNotice).toHaveBeenCalledWith(
      expect.anything(),
      "1",
      "new",
      expect.objectContaining({ state: "dry_run" }),
    );
    expect(r.message.startsWith("[DRY-RUN] ")).toBe(true);
  });

  it("세 번째 시도 실패는 failed, 그 전은 pending", async () => {
    sent.mockResolvedValue({ ok: false, error: "boom" });
    s.loadNoticeRows.mockResolvedValue([
      row({ item_id: "1", new_state: "pending", new_attempts: 2 }),
      row({ item_id: "2", new_state: "pending", new_attempts: 0 }),
    ]);
    listReturns([item({ id: "1" }), item({ id: "2" })]);
    const r = await runSmsSenderRequestNotify();
    const states = s.finishNotice.mock.calls.map((c) => [c[1], c[3].state]);
    expect(states).toEqual([
      ["1", "failed"],
      ["2", "pending"],
    ]);
    expect(r.ok).toBe(false);
    expect(r.message).toContain(" · 실패 2건");
  });

  it("목록 읽기 실패면 ok:false 이고 스냅샷 함수를 안 부른다", async () => {
    vi.mocked(fetchRequestItems).mockRejectedValue(
      new RequestListError("읽지 못했습니다"),
    );
    const r = await runSmsSenderRequestNotify();
    expect(r).toEqual({ ok: false, message: "읽지 못했습니다" });
    expect(s.loadNoticeRows).not.toHaveBeenCalled();
    expect(s.insertNoticeRows).not.toHaveBeenCalled();
    expect(s.updateLastStatus).not.toHaveBeenCalled();
  });

  it("RequestListError 가 아닌 오류는 원문 없이 고정 문구", async () => {
    vi.mocked(fetchRequestItems).mockRejectedValue(
      new Error("https://x?token=SECRET"),
    );
    const r = await runSmsSenderRequestNotify();
    expect(r.ok).toBe(false);
    expect(r.message).not.toContain("SECRET");
    expect(s.insertNoticeRows).not.toHaveBeenCalled();
  });

  it("DB 오류도 ok:false 로 끝나고 던지지 않는다", async () => {
    listReturns([item()]);
    s.loadNoticeRows.mockRejectedValue(new Error("db secret"));
    const r = await runSmsSenderRequestNotify();
    expect(r.ok).toBe(false);
    expect(r.message).not.toContain("secret");
  });

  it("malformed 가 있으면 ok:false, 메시지에 '형식이 맞지 않는 행'", async () => {
    listReturns([], 2);
    const r = await runSmsSenderRequestNotify();
    expect(r.ok).toBe(false);
    expect(r.message).toContain(" · 형식이 맞지 않는 행 2건");
  });

  it("변화 없음", async () => {
    s.loadNoticeRows.mockResolvedValue([row({ item_id: "1" })]);
    listReturns([item()]);
    const r = await runSmsSenderRequestNotify();
    expect(r.message).toBe("변화 없음 (1행)");
  });

  it("메시지·details 에 메일 주소가 없다", async () => {
    listReturns([item({ status: "완료" })]);
    const r = await runSmsSenderRequestNotify();
    expect(JSON.stringify(r)).not.toContain("@");
  });
});

describe("registry", () => {
  it("sms-sender-request-notify 는 hourly 로 등록된다", () => {
    const job = AUTOMATION_JOBS.find(
      (j) => j.id === "sms-sender-request-notify",
    );
    expect(job?.cadence).toBe("hourly");
    expect(job?.cooldownMinutes).toBe(1);
  });
});
