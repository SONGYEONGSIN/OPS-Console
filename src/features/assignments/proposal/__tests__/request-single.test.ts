import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * 단건 배정 요청 — **신규배정 탭의 `[배정 요청]` 이 누르는 것**(설계 §6.3).
 *
 * 화면이 admin 라우트 안에 있어도 server action 에는 라우트 가드가 없다. 주소만
 * 알면 누구나 부를 수 있고, 적재된 요청은 회사 PC 폴러가 가져가 **원장을 바꾸는
 * 제안**이 된다. 그래서 가림이 아니라 여기서 권한을 다시 본다.
 */
const getCurrentOperator = vi.fn();
const revalidatePath = vi.fn();
const enqueue = vi.fn();

vi.mock("server-only", () => ({}));
vi.mock("@/features/auth/queries", () => ({
  getCurrentOperator: () => getCurrentOperator(),
}));
vi.mock("next/cache", () => ({
  revalidatePath: (...a: unknown[]) => revalidatePath(...a),
}));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({}) }));
vi.mock("../../propose-requests/enqueue", () => ({
  enqueueProposeRequest: (...a: unknown[]) => enqueue(...a),
}));

import { requestSingleProposal } from "../actions";

const TARGET = {
  academicYear: 2027,
  universityName: "새대",
  workKind: "원서접수",
};

describe("requestSingleProposal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getCurrentOperator.mockResolvedValue({
      email: "admin@x.com",
      permission: "admin",
    });
    enqueue.mockResolvedValue({ ok: true, skipped: false, message: "적재함" });
  });

  it("admin이 아니면 적재조차 하지 않는다", async () => {
    getCurrentOperator.mockResolvedValue({
      email: "member@x.com",
      permission: "member",
    });

    const r = await requestSingleProposal(TARGET);

    expect(r.ok).toBe(false);
    expect(enqueue).not.toHaveBeenCalled();
  });

  it("로그인하지 않았으면 적재하지 않는다", async () => {
    getCurrentOperator.mockResolvedValue(null);

    const r = await requestSingleProposal(TARGET);

    expect(r.ok).toBe(false);
    expect(enqueue).not.toHaveBeenCalled();
  });

  it("요청자는 누른 사람이다 — 자동화 이름으로 적재하지 않는다", async () => {
    /*
     * `requested_by` 가 'automation' 으로 남으면 나중에 그 제안이 왜 생겼는지
     * 물을 곳이 없다. 사람이 지목한 단건은 사람 이름으로 남아야 한다.
     */
    await requestSingleProposal(TARGET);

    expect(enqueue).toHaveBeenCalledWith("admin@x.com", {
      academicYear: 2027,
      kind: "single",
      universityName: "새대",
      workKind: "원서접수",
    });
  });

  it("이미 대기 중이면 그 사실을 그대로 전한다 — 두 번 누른 것은 실패가 아니다", async () => {
    enqueue.mockResolvedValue({
      ok: false,
      skipped: true,
      message: "이미 대기/진행 중인 판정 요청이 있습니다.",
    });

    const r = await requestSingleProposal(TARGET);

    expect(r).toMatchObject({ skipped: true });
    expect(r.message).toMatch(/이미 대기/);
  });

  it("적재하면 화면을 다시 그린다 — 누른 흔적이 안 보이면 또 누른다", async () => {
    await requestSingleProposal(TARGET);

    expect(revalidatePath).toHaveBeenCalledWith("/dashboard/work-assignment");
  });
});
