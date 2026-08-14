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

import { requestEntertestRun } from "../actions";

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
