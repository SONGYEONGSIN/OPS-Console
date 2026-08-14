import { describe, it, expect, vi, beforeEach } from "vitest";

const h = vi.hoisted(() => ({
  from: vi.fn(),
  insert: vi.fn(),
  getCurrentOperator: vi.fn(),
  getMyEntertestAccount: vi.fn(),
  findServiceAdmissionType: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({ from: h.from }),
}));
vi.mock("@/features/auth/queries", () => ({
  getCurrentOperator: h.getCurrentOperator,
}));
vi.mock("../queries", () => ({
  getMyEntertestAccount: h.getMyEntertestAccount,
  findServiceAdmissionType: h.findServiceAdmissionType,
}));

import { cancelEntertestRun, requestEntertestRun } from "../actions";

function form(serviceId: string): FormData {
  const fd = new FormData();
  fd.set("serviceId", serviceId);
  return fd;
}

/** 적재된 insert payload의 target_url. */
function insertedUrl(): string {
  return h.insert.mock.calls[0][0].target_url;
}

describe("requestEntertestRun — 접수구분에 따른 target_url", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    h.getCurrentOperator.mockResolvedValue({ email: "me@x.com" });
    h.getMyEntertestAccount.mockResolvedValue("jt29005~jt29010");
    h.insert.mockResolvedValue({ error: null });
    h.from.mockReturnValue({
      // 대기/진행 중 중복 체크 — 항상 비어 있음
      select: () => ({
        in: () => ({ limit: async () => ({ data: [], error: null }) }),
      }),
      insert: h.insert,
    });
  });

  it("공통원서 서비스는 nstest 주소로 적재한다", async () => {
    h.findServiceAdmissionType.mockResolvedValue({
      admissionType: "공통원서",
    });

    const r = await requestEntertestRun(undefined, form("1130058"));

    expect(r.ok).toBe(true);
    expect(insertedUrl()).toBe(
      "https://nstest.jinhakapply.com/Notice/1130058/A",
    );
  });

  it("반응형원서 서비스는 entertest 주소로 적재한다", async () => {
    h.findServiceAdmissionType.mockResolvedValue({
      admissionType: "반응형원서",
    });

    const r = await requestEntertestRun(undefined, form("1130058"));

    expect(r.ok).toBe(true);
    expect(insertedUrl()).toBe(
      "https://entertest.jinhakapply.com/Notice/1130058/A",
    );
  });

  it("서비스를 찾지 못하면 적재하지 않는다", async () => {
    // closing_services는 매일 덮어써서 화면 렌더 후 사라질 수 있다.
    // 접수구분을 모르면 호스트를 정할 수 없으므로 틀린 주소를 만들지 않는다.
    h.findServiceAdmissionType.mockResolvedValue(null);

    const r = await requestEntertestRun(undefined, form("1130058"));

    expect(r.ok).toBe(false);
    expect(h.insert).not.toHaveBeenCalled();
  });
});

/** delete().eq()...select() 체이닝 목. eq 호출 인자를 기록해 필터를 검증한다. */
function deleteChain(rows: { id: string }[] | null) {
  const eqCalls: [string, unknown][] = [];
  const chain = {
    eq(col: string, val: unknown) {
      eqCalls.push([col, val]);
      return chain;
    },
    async select() {
      return { data: rows, error: null };
    },
  };
  return { chain, eqCalls };
}

const RUN_ID = "5aaa587a-640b-442a-9cbf-85f99321319e";

function cancelForm(runId: string): FormData {
  const fd = new FormData();
  fd.set("runId", runId);
  return fd;
}

describe("cancelEntertestRun — 대기 중인 요청 취소", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("본인 대기 요청을 취소한다 — pending·본인 조건을 삭제 필터에 건다", async () => {
    h.getCurrentOperator.mockResolvedValue({
      email: "me@x.com",
      permission: "member",
    });
    const { chain, eqCalls } = deleteChain([{ id: RUN_ID }]);
    h.from.mockReturnValue({ delete: () => chain });

    const r = await cancelEntertestRun(undefined, cancelForm(RUN_ID));

    expect(r.ok).toBe(true);
    // 폴러 claim과 경합하므로 조회 후 삭제가 아니라 필터로 한 번에 건다.
    expect(eqCalls).toContainEqual(["id", RUN_ID]);
    expect(eqCalls).toContainEqual(["status", "pending"]);
    expect(eqCalls).toContainEqual(["requested_by", "me@x.com"]);
  });

  it("admin은 남의 요청도 취소한다 — 요청자 조건을 걸지 않는다", async () => {
    h.getCurrentOperator.mockResolvedValue({
      email: "admin@x.com",
      permission: "admin",
    });
    const { chain, eqCalls } = deleteChain([{ id: RUN_ID }]);
    h.from.mockReturnValue({ delete: () => chain });

    const r = await cancelEntertestRun(undefined, cancelForm(RUN_ID));

    expect(r.ok).toBe(true);
    expect(eqCalls.map(([col]) => col)).not.toContain("requested_by");
  });

  it("이미 실행이 시작됐거나 남의 요청이면 취소되지 않는다", async () => {
    h.getCurrentOperator.mockResolvedValue({
      email: "me@x.com",
      permission: "member",
    });
    // 필터에 걸려 삭제된 행이 0건 — pending이 아니거나 본인 것이 아님.
    const { chain } = deleteChain([]);
    h.from.mockReturnValue({ delete: () => chain });

    const r = await cancelEntertestRun(undefined, cancelForm(RUN_ID));

    expect(r.ok).toBe(false);
  });

  it("runId가 uuid가 아니면 DB를 건드리지 않는다", async () => {
    h.getCurrentOperator.mockResolvedValue({
      email: "me@x.com",
      permission: "member",
    });

    const r = await cancelEntertestRun(undefined, cancelForm("not-a-uuid"));

    expect(r.ok).toBe(false);
    expect(h.from).not.toHaveBeenCalled();
  });
});
