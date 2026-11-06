import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { RawDocFile } from "@/features/sms-sender/types";
import type { UploadRow } from "../types";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(() => ({})),
}));
vi.mock("@/lib/microsoft/sendmail", () => ({ sendGraphMail: vi.fn() }));
vi.mock("@/features/sms-sender/source", async () => {
  const actual = await vi.importActual<
    typeof import("@/features/sms-sender/source")
  >("@/features/sms-sender/source");
  return { ...actual, fetchDocFiles: vi.fn() };
});
vi.mock("@/features/sms-sender/upload-notify/store", () => ({
  loadUploadRows: vi.fn(),
  insertUploadRows: vi.fn(),
  seedUploads: vi.fn(),
  rearmUploads: vi.fn(),
  fillHashes: vi.fn(),
  updateHashes: vi.fn(),
  recoverUploads: vi.fn(),
  claimUpload: vi.fn(),
  finishUploads: vi.fn(),
}));

import { sendGraphMail } from "@/lib/microsoft/sendmail";
import { SourceFetchError, fetchDocFiles } from "@/features/sms-sender/source";
import * as store from "@/features/sms-sender/upload-notify/store";
import { runDocUploadStep } from "../step";

const MANAGER = "manager@example.test";
const OTHER = "other@example.test";

const file = (over: Partial<RawDocFile> = {}): RawDocFile => ({
  id: "f1",
  name: "(가나대학교) SMS 발신용 대학 전화번호 등록 서류.pdf",
  folder: "진행 중",
  webUrl: "https://example.invalid/f1",
  hash: "h1",
  createdByEmail: OTHER,
  modifiedByEmail: OTHER,
  ...over,
});

const row = (over: Partial<UploadRow> = {}): UploadRow => ({
  item_id: "f1",
  name: "a.pdf",
  folder_path: "진행 중",
  web_url: null,
  content_hash: "h1",
  change_kind: "new",
  state: "sent",
  attempts: 1,
  claimed_at: null,
  first_seen_at: "2026-11-01T00:00:00Z",
  ...over,
});

const sent = vi.mocked(sendGraphMail);
const s = vi.mocked(store);
const files = vi.mocked(fetchDocFiles);

// 행이 하나라도 있어야 첫 실행이 아니다 — 목록에 없는 행 하나를 깔아 둔다.
const OTHER_ROW = row({ item_id: "elsewhere" });

beforeEach(() => {
  vi.resetAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => undefined);
  process.env.SMS_SENDER_REQUEST_MANAGER_EMAIL = MANAGER;
  process.env.SHAREPOINT_DRIVE_ID = "drive";
  delete process.env.MAIL_DRY_RUN;
  s.loadUploadRows.mockResolvedValue([OTHER_ROW]);
  s.claimUpload.mockResolvedValue(true);
  s.finishUploads.mockImplementation(async (_db, ids) => ids);
  sent.mockResolvedValue({ ok: true, messageId: "m" });
});

afterEach(() => {
  delete process.env.SMS_SENDER_REQUEST_MANAGER_EMAIL;
  delete process.env.SHAREPOINT_DRIVE_ID;
  delete process.env.MAIL_DRY_RUN;
});

describe("runDocUploadStep", () => {
  it("env 없으면 ok:false, 이름을 적고 Graph 를 안 부른다", async () => {
    delete process.env.SMS_SENDER_REQUEST_MANAGER_EMAIL;
    delete process.env.SHAREPOINT_DRIVE_ID;
    const r = await runDocUploadStep();
    expect(r).toEqual({
      ok: false,
      message:
        "환경변수 없음: SMS_SENDER_REQUEST_MANAGER_EMAIL, SHAREPOINT_DRIVE_ID",
    });
    expect(files).not.toHaveBeenCalled();
    expect(s.loadUploadRows).not.toHaveBeenCalled();
  });

  it("테이블이 비면 seed 만, 메일 0통", async () => {
    s.loadUploadRows.mockResolvedValue([]);
    files.mockResolvedValue([file(), file({ id: "f2" }), file({ id: "f3" })]);
    const r = await runDocUploadStep();
    expect(r.ok).toBe(true);
    expect(r.message).toBe("처음 실행 — 기존 파일 3개 적재, 발송 없음");
    expect(s.seedUploads).toHaveBeenCalledTimes(1);
    expect(s.insertUploadRows).not.toHaveBeenCalled();
    expect(
      s.seedUploads.mock.calls[0]?.[1].every((x) => x.state === "seeded"),
    ).toBe(true);
    expect(sent).not.toHaveBeenCalled();
  });

  it("recover → rearm → fill → 해시 갱신 → insert 순서로 기록한다", async () => {
    files.mockResolvedValue([
      file({ id: "r", hash: "h2" }),
      file({ id: "fill", hash: "h2" }),
      file({ id: "x", name: "목록.xlsx", hash: "h2" }),
      file({ id: "new" }),
      file({ id: "stale" }),
    ]);
    s.loadUploadRows.mockResolvedValue([
      row({ item_id: "r" }),
      row({ item_id: "fill", content_hash: null }),
      row({ item_id: "x", name: "목록.xlsx" }),
      row({
        item_id: "stale",
        state: "sending",
        attempts: 3,
        claimed_at: "2000-01-01T00:00:00Z",
      }),
    ]);
    await runDocUploadStep();
    const order = [
      s.recoverUploads,
      s.rearmUploads,
      s.fillHashes,
      s.updateHashes,
      s.insertUploadRows,
      s.claimUpload,
    ].map((fn) => fn.mock.invocationCallOrder[0] ?? Infinity);
    expect(order).toEqual([...order].sort((a, b) => a - b));
    expect(s.updateHashes.mock.calls[0]?.[1]).toEqual([
      { item_id: "x", prevHash: "h1", content_hash: "h2" },
    ]);
    expect(s.recoverUploads.mock.calls[0]?.[1]).toEqual([
      { item_id: "stale", state: "failed" },
    ]);
  });

  it("한 실행에 100건까지만 잡아 보내고, 앞 실행에서 넘어온 행을 먼저, 나머지는 다음 실행으로", async () => {
    const fresh = Array.from({ length: 104 }, (_, i) =>
      file({ id: `n${String(i).padStart(3, "0")}` }),
    );
    files.mockResolvedValue([...fresh, file({ id: "carried" })]);
    s.loadUploadRows.mockResolvedValue([
      OTHER_ROW,
      row({ item_id: "carried", state: "pending", attempts: 1 }),
    ]);
    const r = await runDocUploadStep();
    expect(s.claimUpload).toHaveBeenCalledTimes(100);
    expect(s.claimUpload.mock.calls[0]?.[1]).toBe("carried");
    expect(sent.mock.calls[0]?.[0].subject).toBe(
      "[내부관리자] 학교별 제출 서류 100건 업로드",
    );
    const finished = s.finishUploads.mock.calls[0]?.[1] ?? [];
    expect(finished).toHaveLength(100);
    expect(finished).not.toContain("n099");
    expect(r).toMatchObject({
      ok: true,
      message: "새 파일 100건 · 교체 0건 알림 · 다음 실행으로 미룬 5건",
      details: { uploadDeferred: 5 },
    });
  });

  it("새 파일 2·교체 1 → 메일 1통, 제목 3건, 보내는 메일함=받는 사람=담당자", async () => {
    files.mockResolvedValue([
      file({ id: "a" }),
      file({ id: "b" }),
      file({ id: "c", hash: "h2" }),
    ]);
    s.loadUploadRows.mockResolvedValue([OTHER_ROW, row({ item_id: "c" })]);
    const r = await runDocUploadStep();
    expect(sent).toHaveBeenCalledTimes(1);
    expect(sent.mock.calls[0]?.[0]).toMatchObject({
      senderUserId: MANAGER,
      toEmail: MANAGER,
      subject: "[내부관리자] 학교별 제출 서류 3건 업로드",
    });
    expect(s.finishUploads).toHaveBeenCalledWith(
      {},
      ["a", "b", "c"],
      expect.objectContaining({ state: "sent", messageId: "m" }),
    );
    expect(r).toMatchObject({
      ok: true,
      message: "새 파일 2건 · 교체 1건 알림",
      details: {
        uploadFiles: 3,
        uploadNew: 2,
        uploadReplaced: 1,
        uploadSkippedSelf: 0,
        uploadFailed: 0,
      },
    });
  });

  it("claim 을 놓친 행은 메일에 안 담기고 실패로 세지 않는다", async () => {
    files.mockResolvedValue([file({ id: "a" }), file({ id: "b" })]);
    s.claimUpload.mockImplementation(async (_db, id) => id === "a");
    const r = await runDocUploadStep();
    expect(sent.mock.calls[0]?.[0].subject).toBe(
      "[내부관리자] 학교별 제출 서류 1건 업로드",
    );
    expect(s.finishUploads.mock.calls[0]?.[1]).toEqual(["a"]);
    expect(r).toMatchObject({
      ok: true,
      message: "새 파일 1건 · 교체 0건 알림",
    });
  });

  it("모두 claim 을 놓치면 메일 0통, 실패 아님", async () => {
    files.mockResolvedValue([file()]);
    s.claimUpload.mockResolvedValue(false);
    const r = await runDocUploadStep();
    expect(sent).not.toHaveBeenCalled();
    expect(s.finishUploads).not.toHaveBeenCalled();
    expect(r).toMatchObject({ ok: true, message: "변화 없음 (파일 1개)" });
  });

  it("발송 실패 — attempts 2 인 행은 failed, 0 인 행은 pending, 코드만 메시지에", async () => {
    files.mockResolvedValue([file({ id: "old" }), file({ id: "fresh" })]);
    s.loadUploadRows.mockResolvedValue([
      OTHER_ROW,
      row({ item_id: "old", state: "pending", attempts: 2 }),
    ]);
    sent.mockResolvedValue({ ok: false, error: "graph_403: secret-body" });
    const r = await runDocUploadStep();
    expect(s.finishUploads).toHaveBeenCalledWith(
      {},
      ["old"],
      expect.objectContaining({ state: "failed", error: "graph_403" }),
    );
    expect(s.finishUploads).toHaveBeenCalledWith(
      {},
      ["fresh"],
      expect.objectContaining({ state: "pending", error: "graph_403" }),
    );
    expect(r.ok).toBe(false);
    expect(r.message).toContain("실패 2건 (graph_403)");
    expect(JSON.stringify(r)).not.toContain("secret-body");
  });

  it("성공 기록이 일부만 갱신되면 claim_lost 로 센다", async () => {
    files.mockResolvedValue([file({ id: "a" }), file({ id: "b" })]);
    s.finishUploads.mockResolvedValue(["a"]);
    const r = await runDocUploadStep();
    expect(r).toMatchObject({
      ok: false,
      message: "새 파일 1건 · 교체 0건 알림 · 실패 1건 (claim_lost)",
      details: { uploadNew: 1, uploadFailed: 1 },
    });
  });

  it("MAIL_DRY_RUN=true 면 sendGraphMail 0회, dry_run 으로 기록, message 에 [DRY-RUN] 없음", async () => {
    process.env.MAIL_DRY_RUN = "TRUE";
    files.mockResolvedValue([file()]);
    const r = await runDocUploadStep();
    expect(sent).not.toHaveBeenCalled();
    expect(s.finishUploads).toHaveBeenCalledWith(
      {},
      ["f1"],
      expect.objectContaining({ state: "dry_run" }),
    );
    expect(r.message).not.toContain("[DRY-RUN]");
    expect(r).toMatchObject({
      ok: true,
      message: "새 파일 1건 · 교체 0건 알림",
    });
  });

  it("본인 업로드만 있으면 메일 0통, '담당자 본인 업로드 1건 제외'", async () => {
    files.mockResolvedValue([file({ createdByEmail: MANAGER })]);
    const r = await runDocUploadStep();
    expect(sent).not.toHaveBeenCalled();
    expect(r.ok).toBe(true);
    expect(r.message).toContain("담당자 본인 업로드 1건 제외");
    expect(r.details).toMatchObject({ uploadSkippedSelf: 1 });
  });

  it("SourceFetchError 는 그 문구, 다른 오류는 고정 문구(원문 없음)", async () => {
    files.mockRejectedValue(
      new SourceFetchError("제출 서류 폴더 목록 읽기 실패 (500)"),
    );
    await expect(runDocUploadStep()).resolves.toEqual({
      ok: false,
      message: "제출 서류 폴더 목록 읽기 실패 (500)",
    });
    files.mockRejectedValue(new Error("raw https://graph secret"));
    const r = await runDocUploadStep();
    expect(r).toEqual({
      ok: false,
      message: "제출 서류 폴더를 읽지 못했습니다.",
    });
    expect(s.loadUploadRows).not.toHaveBeenCalled();
  });

  it("DB 오류도 던지지 않고 ok:false", async () => {
    files.mockResolvedValue([file()]);
    s.loadUploadRows.mockRejectedValue(new Error("db secret"));
    await expect(runDocUploadStep()).resolves.toEqual({
      ok: false,
      message: "제출 서류 업로드 알림 기록 처리 중 오류가 발생했습니다.",
    });
  });

  it("결과 JSON 에 @ 가 없다", async () => {
    files.mockResolvedValue([
      file({ id: "a" }),
      file({ id: "b", createdByEmail: MANAGER }),
    ]);
    sent.mockResolvedValue({ ok: false, error: `graph_400: ${OTHER}` });
    const r = await runDocUploadStep();
    expect(JSON.stringify(r)).not.toContain("@");
  });
});
