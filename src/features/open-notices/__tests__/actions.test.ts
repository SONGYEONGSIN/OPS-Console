import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
import { revalidatePath } from "next/cache";

const insertMock: Mock = vi.fn(async () => ({ error: null }));
/** delete().eq().eq() 체인 — 마지막 eq 가 결과를 돌려준다 */
const deleteEq2: Mock = vi.fn(async () => ({ error: null }));
const deleteEq1: Mock = vi.fn(() => ({ eq: deleteEq2 }));
const deleteMock: Mock = vi.fn(() => ({ eq: deleteEq1 }));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(() => ({
    from: () => ({ insert: insertMock, delete: deleteMock }),
  })),
}));

const getCurrentOperator: Mock = vi.fn();
vi.mock("@/features/auth/queries", () => ({
  getCurrentOperator: () => getCurrentOperator(),
}));

const findOpenNoticeService: Mock = vi.fn();
vi.mock("../queries", () => ({
  findOpenNoticeService: (...a: unknown[]) => findOpenNoticeService(...a),
}));

import {
  enableOpenNoticeAutoSendAction,
  disableOpenNoticeAutoSendAction,
} from "../actions";

const FUTURE = new Date(Date.now() + 7 * 24 * 3600_000).toISOString();
const PAST = new Date(Date.now() - 24 * 3600_000).toISOString();

function fd(over: Record<string, string> = {}) {
  const f = new FormData();
  f.set("serviceId", "1130058");
  f.set("universityName", "조선대학교");
  f.set("serviceName", "2027학년도 수시모집");
  f.set("toEmail", "a@b.com");
  f.set("toName", "김담당");
  f.set("cc", JSON.stringify([{ email: "c@d.com" }]));
  f.set("subject", "[진학어플라이] 조선대학교 2027학년도 수시모집 인터넷 원서접수 오픈 안내");
  f.set("body", "· 대학명   : 조선대학교");
  for (const [k, v] of Object.entries(over)) f.set(k, v);
  return f;
}

const service = (over: Record<string, unknown> = {}) => ({
  serviceId: 1130058,
  operatorName: "나",
  universityName: "조선대학교",
  serviceName: "2027학년도 수시모집",
  writeStartAt: FUTURE,
  ...over,
});

describe("enableOpenNoticeAutoSendAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    insertMock.mockResolvedValue({ error: null });
    deleteEq2.mockResolvedValue({ error: null });
    getCurrentOperator.mockResolvedValue({
      email: "me@op.com",
      operator: { name: "나" },
      permission: "member",
    });
    findOpenNoticeService.mockResolvedValue(service());
  });

  it("예약 시각을 폼이 아니라 DB 의 오픈 시각에서 읽는다", async () => {
    const r = await enableOpenNoticeAutoSendAction(
      undefined,
      // 폼에 엉뚱한 시각을 실어 보내도 무시돼야 한다
      fd({ scheduledAt: "2030-01-01T00:00" }),
    );
    expect(r?.ok).toBe(true);
    expect(findOpenNoticeService).toHaveBeenCalledWith(1130058);
    const row = (insertMock.mock.calls[0] as [Record<string, unknown>])[0];
    expect(row.scheduled_at).toBe(new Date(FUTURE).toISOString());
    expect(row.status).toBe("scheduled");
    expect(row.service_id).toBe(1130058);
  });

  it("켜기 전에 기존 대기 예약을 지운다 (중복 예약 방지)", async () => {
    await enableOpenNoticeAutoSendAction(undefined, fd());
    expect(deleteMock).toHaveBeenCalledTimes(1);
    expect(deleteEq1).toHaveBeenCalledWith("service_id", 1130058);
    expect(deleteEq2).toHaveBeenCalledWith("status", "scheduled");
  });

  it("배지가 갱신되도록 dev-test 경로를 revalidate 한다", async () => {
    await enableOpenNoticeAutoSendAction(undefined, fd());
    expect(revalidatePath).toHaveBeenCalledWith("/dashboard/dev-test");
  });

  it("오픈 시각이 지났으면 거부 — 자동 발송을 걸 자리가 없다", async () => {
    findOpenNoticeService.mockResolvedValue(service({ writeStartAt: PAST }));
    const r = await enableOpenNoticeAutoSendAction(undefined, fd());
    expect(r?.ok).toBe(false);
    expect(insertMock).not.toHaveBeenCalled();
  });

  it("오픈 시각이 없으면 거부", async () => {
    findOpenNoticeService.mockResolvedValue(service({ writeStartAt: null }));
    const r = await enableOpenNoticeAutoSendAction(undefined, fd());
    expect(r?.ok).toBe(false);
    expect(insertMock).not.toHaveBeenCalled();
  });

  it("미인증이면 거부", async () => {
    getCurrentOperator.mockResolvedValue(null);
    const r = await enableOpenNoticeAutoSendAction(undefined, fd());
    expect(r?.ok).toBe(false);
    expect(insertMock).not.toHaveBeenCalled();
  });

  it("수신자 형식이 틀리면 거부", async () => {
    const r = await enableOpenNoticeAutoSendAction(undefined, fd({ toEmail: "x" }));
    expect(r?.ok).toBe(false);
    expect(insertMock).not.toHaveBeenCalled();
  });

  describe("권한", () => {
    it("남의 담당이면 거부", async () => {
      findOpenNoticeService.mockResolvedValue(service({ operatorName: "다른사람" }));
      const r = await enableOpenNoticeAutoSendAction(undefined, fd());
      expect(r?.ok).toBe(false);
      expect(insertMock).not.toHaveBeenCalled();
    });

    it("admin 은 남의 담당도 켤 수 있다", async () => {
      getCurrentOperator.mockResolvedValue({
        email: "boss@op.com",
        operator: { name: "관리자" },
        permission: "admin",
      });
      findOpenNoticeService.mockResolvedValue(service({ operatorName: "다른사람" }));
      const r = await enableOpenNoticeAutoSendAction(undefined, fd());
      expect(r?.ok).toBe(true);
    });

    it("operators 매칭이 없으면 담당 건이 없다 (거부)", async () => {
      getCurrentOperator.mockResolvedValue({
        email: "dev@op.com",
        operator: null,
        permission: "member",
      });
      const r = await enableOpenNoticeAutoSendAction(undefined, fd());
      expect(r?.ok).toBe(false);
    });

    it("DB 에 없는 서비스면 거부", async () => {
      findOpenNoticeService.mockResolvedValue(null);
      const r = await enableOpenNoticeAutoSendAction(undefined, fd());
      expect(r?.ok).toBe(false);
    });
  });
});

describe("disableOpenNoticeAutoSendAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    deleteEq2.mockResolvedValue({ error: null });
    getCurrentOperator.mockResolvedValue({
      email: "me@op.com",
      operator: { name: "나" },
      permission: "member",
    });
    findOpenNoticeService.mockResolvedValue(service());
  });

  it("대기 예약만 지운다 — 이미 나간 이력은 남긴다", async () => {
    const f = new FormData();
    f.set("serviceId", "1130058");
    const r = await disableOpenNoticeAutoSendAction(undefined, f);
    expect(r?.ok).toBe(true);
    expect(deleteEq1).toHaveBeenCalledWith("service_id", 1130058);
    expect(deleteEq2).toHaveBeenCalledWith("status", "scheduled");
    expect(revalidatePath).toHaveBeenCalledWith("/dashboard/dev-test");
  });

  it("남의 담당이면 거부", async () => {
    findOpenNoticeService.mockResolvedValue(service({ operatorName: "다른사람" }));
    const f = new FormData();
    f.set("serviceId", "1130058");
    const r = await disableOpenNoticeAutoSendAction(undefined, f);
    expect(r?.ok).toBe(false);
    expect(deleteMock).not.toHaveBeenCalled();
  });

  it("오픈 시각이 지났어도 끌 수는 있다", async () => {
    findOpenNoticeService.mockResolvedValue(service({ writeStartAt: PAST }));
    const f = new FormData();
    f.set("serviceId", "1130058");
    const r = await disableOpenNoticeAutoSendAction(undefined, f);
    expect(r?.ok).toBe(true);
  });
});
