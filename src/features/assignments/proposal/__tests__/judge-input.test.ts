import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockAdmin, mockLedger, mockSources, state } = vi.hoisted(() => ({
  mockAdmin: vi.fn(),
  mockLedger: vi.fn(),
  mockSources: vi.fn(),
  state: {
    operators: [] as unknown[],
    operatorsError: null as { message: string } | null,
  },
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: mockAdmin }));
vi.mock("../../ledger-queries", () => ({ listLedgerRows: mockLedger }));
vi.mock("../../workload-queries", () => ({ loadWorkloadSources: mockSources }));

import { loadJudgeInput } from "../judge-input";

/**
 * 판정 입력 조립 — **폴러 창구에는 세션이 없다**(CRON_SECRET). 그래서 service_role
 * 로 읽고, 화면과 **같은 조회 함수**에 그 클라이언트를 넘긴다(§6.3).
 *
 * GET(프롬프트)과 POST(검산)가 각각 한 번씩 부른다. 같은 값을 재사용하지 않는
 * 이유는 **G2(경합)가 지금 원장을 봐야** 하기 때문이다 — 판정이 도는 사이 사람이
 * 손으로 고쳤을 수 있다(§5.4).
 */
const cell = (
  university_name: string,
  assignee_email: string | null,
  work_kind = "원서접수",
  subtype = "수시",
  role = "운영",
) => ({ university_name, work_kind, subtype, role, assignee_email });

const operator = (email: string, o: Record<string, unknown> = {}) => ({
  email,
  name: `이름-${email}`,
  tenure_group: "2",
  assignable: true,
  status: "active",
  hired_at: "2020-01-02",
  career_start_at: null,
  ...o,
});

const NOW = new Date("2026-09-18T10:00:00+09:00");

describe("loadJudgeInput", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.operators = [operator("a@x.com"), operator("b@x.com")];
    state.operatorsError = null;
    mockAdmin.mockReturnValue({
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          then: (resolve: (v: unknown) => void) =>
            resolve({ data: state.operators, error: state.operatorsError }),
        })),
      })),
    });
    mockLedger.mockResolvedValue([
      cell("가대", "a@x.com"),
      cell("나대", "a@x.com"),
      cell("다대", "b@x.com"),
    ]);
    mockSources.mockResolvedValue({
      serviceCounts: {
        "가대|원서접수": 4,
        "나대|원서접수": 2,
        "다대|원서접수": 2,
      },
      spans: [],
    });
  });

  it("프롬프트와 후보, 그리고 검산에 필요한 것을 함께 준다", async () => {
    const r = await loadJudgeInput(2027, NOW);

    expect(r.prompt).toMatch(/운영자별 실측/);
    expect(r.candidates).toHaveLength(3);
    expect(r.gateContext.ledger).toHaveLength(3);
    expect(r.gateContext.operators).toHaveLength(2);
  });

  it("조회에 service_role 클라이언트를 넘긴다 — 세션이 없다", async () => {
    await loadJudgeInput(2027, NOW);

    expect(mockLedger).toHaveBeenCalledWith(2027, expect.anything());
    expect(mockSources).toHaveBeenCalledWith(NOW, expect.anything());
  });

  it("활성 명부만 본다 — 퇴사자가 끼면 그룹 평균이 아래로 끌린다", async () => {
    state.operators = [
      operator("a@x.com"),
      operator("퇴사@x.com", { status: "deleted" }),
    ];

    const r = await loadJudgeInput(2027, NOW);

    expect(r.gateContext.operators.map((o) => o.email)).toEqual(["a@x.com"]);
  });

  it("명부 조회가 실패하면 던진다 — 빈 명부는 '배정 대상 0명' 으로 읽힌다", async () => {
    state.operatorsError = { message: "boom" };

    await expect(loadJudgeInput(2027, NOW)).rejects.toThrow(/boom/);
  });

  it("배정 대상이 한 명도 없으면 던진다 — 모델에게 빈 표를 주지 않는다", async () => {
    state.operators = [operator("팀장@x.com", { assignable: false })];

    await expect(loadJudgeInput(2027, NOW)).rejects.toThrow(/배정 대상/);
  });

  it("프롬프트 해시는 프롬프트에서 나온다 — 같은 물음이면 같은 값이다", async () => {
    const a = await loadJudgeInput(2027, NOW);
    const b = await loadJudgeInput(2027, NOW);

    expect(a.promptHash).toBe(b.promptHash);
    expect(a.promptHash).toMatch(/^[0-9a-f]{16}$/);
  });

  it("물음이 다르면 해시도 다르다", async () => {
    const all = await loadJudgeInput(2027, NOW);
    const one = await loadJudgeInput(2027, NOW, {
      university_name: "가대",
      work_kind: "원서접수",
    });

    expect(one.promptHash).not.toBe(all.promptHash);
  });

  it("단건은 후보를 그 한 칸으로 좁힌다", async () => {
    const r = await loadJudgeInput(2027, NOW, {
      university_name: "가대",
      work_kind: "원서접수",
    });

    expect(r.candidates).toEqual([
      {
        university_name: "가대",
        work_kind: "원서접수",
        assignee_email: "a@x.com",
      },
    ]);
  });

  it("검산 맥락에는 창도 함께 담긴다 — G6 이 같은 창으로 다시 잰다", async () => {
    const r = await loadJudgeInput(2027, NOW);

    expect(r.gateContext.windows.year).toEqual(["2026-03-01", "2027-02-28"]);
  });
});
