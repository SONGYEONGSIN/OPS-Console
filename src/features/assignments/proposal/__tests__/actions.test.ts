import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * 제안 적용·반려 — **마지막 승인은 관리자가 한다**(설계 rev 2).
 *
 * 모델이 이상한 답을 내도 원장은 그대로이고 반려가 기본 선택지다. 그래서 이 파일이
 * 원장에 쓰는 유일한 제안 경로이고, 가림이 아니라 여기서 권한을 다시 본다.
 */
const getCurrentOperator = vi.fn();
const revalidatePath = vi.fn();

vi.mock("@/features/auth/queries", () => ({
  getCurrentOperator: () => getCurrentOperator(),
}));
vi.mock("next/cache", () => ({
  revalidatePath: (...a: unknown[]) => revalidatePath(...a),
}));

type Row = Record<string, unknown>;
type TableState = {
  select?: { data: Row[] | Row | null; error?: { message: string } | null };
  write?: { error?: { message: string } | null };
};

const state: Record<string, TableState> = {};
/** 테이블별로 무엇이 쓰였는지 — 원장을 건드렸는지가 곧 반려의 계약이다. */
const writes: { table: string; verb: string; payload: unknown }[] = [];

function table(name: string) {
  const st = () => state[name] ?? {};
  const chain: Record<string, unknown> = {};
  const self = () => chain;
  for (const verb of ["eq", "in", "order", "limit", "lt"] as const) {
    chain[verb] = self;
  }
  chain.select = () => chain;
  chain.maybeSingle = () =>
    Promise.resolve({
      data: st().select?.data ?? null,
      error: st().select?.error ?? null,
    });
  chain.then = (resolve: (v: unknown) => unknown) =>
    Promise.resolve({
      data: st().select?.data ?? [],
      error: st().select?.error ?? null,
    }).then(resolve);
  for (const verb of ["upsert", "insert", "update"] as const) {
    chain[verb] = (payload: unknown) => {
      writes.push({ table: name, verb, payload });
      const done = Promise.resolve({
        data: null,
        error: st().write?.error ?? null,
      });
      const w: Record<string, unknown> = {
        eq: () => w,
        in: () => w,
        select: () => w,
        maybeSingle: () => done,
        then: (r: (v: unknown) => unknown) => done.then(r),
      };
      return w;
    };
  }
  return chain;
}

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({ from: (t: string) => table(t) }),
}));

const { applyProposalBatch, rejectProposalBatch } = await import("../actions");

const PROPOSAL = {
  id: "p1",
  batch_id: "b1",
  academic_year: 2027,
  university_name: "가대",
  work_kind: "원서접수",
  subtype: "",
  role: "운영",
  prev_assignee: "a@x.com",
  next_assignee: "b@x.com",
  reason: "밀도 균형",
  decision: "pending",
};
const LEDGER_CELL = {
  academic_year: 2027,
  university_name: "가대",
  work_kind: "원서접수",
  subtype: "",
  role: "운영",
  assignee_email: "a@x.com",
  assignee_name: "김가",
};

beforeEach(() => {
  vi.clearAllMocks();
  writes.length = 0;
  for (const k of Object.keys(state)) delete state[k];
  getCurrentOperator.mockResolvedValue({
    email: "admin@x.com",
    permission: "admin",
  });
  state["assignment_proposal_batches"] = {
    select: { data: { id: "b1", status: "pending", academic_year: 2027 } },
  };
  state["assignment_proposals"] = { select: { data: [PROPOSAL] } };
  state["assignments"] = { select: { data: [LEDGER_CELL] } };
  state["operators"] = {
    select: { data: [{ email: "b@x.com", name: "이나" }] },
  };
});

const wrote = (t: string) => writes.filter((w) => w.table === t);

describe("applyProposalBatch", () => {
  it("admin 이 아니면 거부한다", async () => {
    getCurrentOperator.mockResolvedValue({
      email: "x@x.com",
      permission: "member",
    });
    const r = await applyProposalBatch("b1");
    expect(r.ok).toBe(false);
    expect(wrote("assignments")).toHaveLength(0);
  });

  it("원장에 쓰고 이력을 남긴다", async () => {
    const r = await applyProposalBatch("b1");
    expect(r.ok).toBe(true);
    expect(r.ok && r.applied).toBe(1);
    expect(wrote("assignments")).toHaveLength(1);
    expect(wrote("assignment_changes")).toHaveLength(1);
  });

  it("이력의 출처는 proposal 이다 — 손편집과 섞이면 되돌릴 근거가 흐려진다", async () => {
    await applyProposalBatch("b1");
    const hist = wrote("assignment_changes")[0].payload as Row[];
    expect(hist[0]).toMatchObject({
      source: "proposal",
      prev_assignee: "a@x.com",
      next_assignee: "b@x.com",
    });
  });

  it("그 사이 바뀐 칸은 쓰지 않고 건수로 돌려준다", async () => {
    state["assignments"] = {
      select: { data: [{ ...LEDGER_CELL, assignee_email: "c@x.com" }] },
    };
    const r = await applyProposalBatch("b1");
    expect(r.ok && r.conflicted).toBe(1);
    expect(r.ok && r.applied).toBe(0);
    expect(wrote("assignments")).toHaveLength(0);
  });

  it("일부만 적용되면 배치가 partial 이다", async () => {
    state["assignment_proposals"] = {
      select: {
        data: [
          PROPOSAL,
          { ...PROPOSAL, id: "p2", subtype: "정시", prev_assignee: "z@x.com" },
        ],
      },
    };
    state["assignments"] = {
      select: { data: [LEDGER_CELL, { ...LEDGER_CELL, subtype: "정시" }] },
    };
    await applyProposalBatch("b1");
    const batch = wrote("assignment_proposal_batches")[0].payload as Row;
    expect(batch.status).toBe("partial");
  });

  it("전부 적용되면 배치가 applied 다", async () => {
    await applyProposalBatch("b1");
    const batch = wrote("assignment_proposal_batches")[0].payload as Row;
    expect(batch.status).toBe("applied");
    expect(batch.decided_by).toBe("admin@x.com");
  });

  it("명부에 없는 주소면 원장에 쓰지 않는다", async () => {
    // FK 23503 은 사람이 못 읽는다 — 먼저 보고 말로 돌려준다(F14).
    state["operators"] = { select: { data: [] } };
    const r = await applyProposalBatch("b1");
    expect(r.ok).toBe(false);
    expect(r.ok === false && r.error).toMatch(/명부/);
    expect(wrote("assignments")).toHaveLength(0);
  });

  it("이미 결정된 배치는 다시 적용하지 않는다", async () => {
    // 두 번 누르면 이력이 두 줄 남고 두 번째는 거짓이다(이전값이 이미 바뀌었다).
    state["assignment_proposal_batches"] = {
      select: { data: { id: "b1", status: "applied", academic_year: 2027 } },
    };
    const r = await applyProposalBatch("b1");
    expect(r.ok).toBe(false);
    expect(wrote("assignments")).toHaveLength(0);
  });

  it("배치가 없으면 거부한다", async () => {
    state["assignment_proposal_batches"] = { select: { data: null } };
    const r = await applyProposalBatch("b1");
    expect(r.ok).toBe(false);
  });

  it("원장 쓰기가 실패하면 실패로 돌려준다", async () => {
    state["assignments"] = {
      select: { data: [LEDGER_CELL] },
      write: { error: { message: "boom" } },
    };
    const r = await applyProposalBatch("b1");
    expect(r.ok).toBe(false);
    expect(r.ok === false && r.error).toMatch(/boom/);
  });

  it("적용 후 두 화면을 다시 그린다 — 제안 탭은 업무배정으로 옮겨 갔다", async () => {
    /*
     * 제안을 승인하면 원장이 바뀌므로 총괄장 대학배정도, 업무배정 배분현황·제안도
     * 낡는다. #1205 가 라우트를 옮긴 뒤 옛 주소만 남아, **승인한 배치가 화면에서
     * 그대로 pending 으로 보였다** — 새로고침해도 캐시가 그대로라 두 번 누른다.
     */
    await applyProposalBatch("b1");
    expect(revalidatePath).toHaveBeenCalledWith("/dashboard/assignments");
    expect(revalidatePath).toHaveBeenCalledWith("/dashboard/work-assignment");
  });
});

describe("rejectProposalBatch", () => {
  it("admin 이 아니면 거부한다", async () => {
    getCurrentOperator.mockResolvedValue({
      email: "x@x.com",
      permission: "member",
    });
    const r = await rejectProposalBatch("b1");
    expect(r.ok).toBe(false);
  });

  it("**원장을 건드리지 않는다** — 반려가 기본 선택지다", async () => {
    const r = await rejectProposalBatch("b1");
    expect(r.ok).toBe(true);
    expect(wrote("assignments")).toHaveLength(0);
    expect(wrote("assignment_changes")).toHaveLength(0);
  });

  it("배치와 제안에 반려를 적는다", async () => {
    await rejectProposalBatch("b1");
    const batch = wrote("assignment_proposal_batches")[0].payload as Row;
    expect(batch.status).toBe("rejected");
    const props = wrote("assignment_proposals")[0].payload as Row;
    expect(props.decision).toBe("rejected");
  });

  it("반려 후에도 제안 탭을 다시 그린다", async () => {
    await rejectProposalBatch("b1");
    expect(revalidatePath).toHaveBeenCalledWith("/dashboard/work-assignment");
  });

  it("이미 결정된 배치는 반려하지 않는다", async () => {
    state["assignment_proposal_batches"] = {
      select: { data: { id: "b1", status: "applied", academic_year: 2027 } },
    };
    const r = await rejectProposalBatch("b1");
    expect(r.ok).toBe(false);
  });
});
