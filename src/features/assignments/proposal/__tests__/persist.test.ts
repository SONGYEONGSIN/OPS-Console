import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockCreateAdminClient, state } = vi.hoisted(() => ({
  mockCreateAdminClient: vi.fn(),
  state: {
    batchId: "b1" as string | null,
    batchError: null as { message: string } | null,
    proposalsError: null as { message: string } | null,
    inserts: [] as { table: string; rows: unknown }[],
  },
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: mockCreateAdminClient,
}));

import { persistProposalBatch, summarizeGateResult } from "../persist";
import { ASSIGNMENT_LIMITS, type ProposedMove } from "../objective";
import type { GateResult } from "../gate";
import { buildWorkload } from "../../workload";

/**
 * 판정 결과 적재 — **근거를 얼려 둔다**(설계 §5.4).
 *
 * 그룹 값은 `operators` 의 컬럼이라 나중에 바뀐다. 그때 이 배치를 다시 설명할 수
 * 없게 되므로 판정에 쓴 값을 `basis` 에 함께 넣는다. 관리자가 '에이전트가 관리하는
 * 모든 사항' 을 확인해야 하므로(사용자 요구) **모델이 무엇을 보고 그랬는지**도 남는다.
 *
 * **탈락도 남는다**(F11). 게이트를 통과한 줄만 배치에 담기지만, 몇 줄이 왜 떨어졌는지가
 * 안 남으면 관리자는 '에이전트가 3건만 제안했다' 로 읽고 모델이 멍청하다고 결론 낸다.
 *
 * PostgREST 에는 호출 사이 트랜잭션이 없다. 배치를 먼저 넣고 제안을 넣으므로,
 * **'배치는 만들어졌는데 제안 적재가 실패' 를 구분해 말해야** 한다.
 */
const op = (email: string, tenure_group: string | null) => ({
  email,
  name: `이름-${email}`,
  tenure_group,
  assignable: true,
  hired_at: "2020-01-02",
});

const cell = (
  university_name: string,
  assignee_email: string | null,
  work_kind = "원서접수",
  subtype = "수시",
  role = "운영",
) => ({ university_name, work_kind, subtype, role, assignee_email });

const move = (o: Partial<ProposedMove> = {}): ProposedMove => ({
  university_name: "가대",
  work_kind: "원서접수",
  prev_assignee: "a@x.com",
  next_assignee: "b@x.com",
  reason: "2그룹 평균보다 많다",
  ...o,
});

const LEDGER = [
  cell("가대", "a@x.com", "원서접수", "수시"),
  cell("가대", "a@x.com", "원서접수", "정시"),
  cell("가대", null, "원서접수", "수시", "개발"),
  cell("나대", "b@x.com"),
];

const GROUPS = buildWorkload({
  operators: [op("a@x.com", "2"), op("b@x.com", "2")],
  cells: LEDGER,
  serviceCounts: { "가대|원서접수": 4, "나대|원서접수": 2 },
  spans: [],
  windows: {
    week: ["2026-09-14", "2026-09-20"],
    month: ["2026-09-01", "2026-09-30"],
    year: ["2026-03-01", "2027-02-28"],
  },
});

const gateResult = (o: Partial<GateResult> = {}): GateResult => ({
  accepted: [move()],
  rejected: [],
  ...o,
});

const input = (o: Record<string, unknown> = {}) => ({
  academicYear: 2027,
  kind: "annual" as const,
  requestedBy: "automation",
  groups: GROUPS,
  ledger: LEDGER,
  gateResult: gateResult(),
  model: "claude-opus-5",
  promptHash: "abc123",
  verdictRaw: '{"moves":[]}',
  ...o,
});

/** 배치 insert 는 id 를 돌려주고, 제안 insert 는 에러만 돌려준다. */
function wire() {
  mockCreateAdminClient.mockReturnValue({
    from: (table: string) => {
      const b: Record<string, unknown> = {};
      b.insert = (rows: unknown) => {
        state.inserts.push({ table, rows });
        if (table === "assignment_proposal_batches") {
          return {
            select: () => ({
              maybeSingle: () =>
                Promise.resolve({
                  data: state.batchId ? { id: state.batchId } : null,
                  error: state.batchError,
                }),
            }),
          };
        }
        return {
          then: (resolve: (v: unknown) => void) =>
            resolve({ error: state.proposalsError }),
        };
      };
      return b;
    },
  });
}

const rowsFor = (table: string) =>
  state.inserts
    .filter((i) => i.table === table)
    .flatMap((i) => i.rows as unknown[]);

describe("summarizeGateResult", () => {
  it("통과와 탈락을 함께 적는다 — 통과만 적으면 모델이 멍청해 보인다", () => {
    const s = summarizeGateResult(
      gateResult({
        accepted: [move(), move({ university_name: "나대" })],
        rejected: [
          { move: move(), gate: "G4", reason: "갈린 대학" },
          { move: move(), gate: "G6", reason: "편차 악화" },
          { move: move(), gate: "G6", reason: "편차 악화" },
        ],
      }),
    );

    expect(s).toMatch(/이동 2건/);
    expect(s).toMatch(/탈락 3건/);
    // 어느 게이트가 몇 건인지까지 — 그게 곧 조치다(F11).
    expect(s).toMatch(/G4 1/);
    expect(s).toMatch(/G6 2/);
  });

  it("탈락이 없으면 탈락을 적지 않는다", () => {
    expect(summarizeGateResult(gateResult())).toBe("이동 1건");
  });

  it("옮길 것이 없으면 그렇게 적는다 — 빈 배치도 옳은 답이다", () => {
    expect(summarizeGateResult(gateResult({ accepted: [] }))).toMatch(
      /이동 0건/,
    );
  });
});

describe("persistProposalBatch", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.batchId = "b1";
    state.batchError = null;
    state.proposalsError = null;
    state.inserts = [];
    wire();
  });

  it("배치를 먼저 넣고 id 를 돌려준다", async () => {
    const r = await persistProposalBatch(input());

    expect(r).toMatchObject({ ok: true, batchId: "b1" });
    expect(state.inserts[0].table).toBe("assignment_proposal_batches");
  });

  it("basis 에 그룹 구성이 얼려 담긴다 — 3월 갱신 상기가 이걸 견준다", async () => {
    await persistProposalBatch(input());

    const [batch] = rowsFor("assignment_proposal_batches") as {
      basis: { groups: Record<string, string[]> };
    }[];
    expect(batch.basis.groups).toEqual({ "2": ["a@x.com", "b@x.com"] });
  });

  it("basis 에 그룹 목표와 상한이 얼려 담긴다", async () => {
    await persistProposalBatch(input());

    const [batch] = rowsFor("assignment_proposal_batches") as {
      basis: { targets: Record<string, unknown>; limits: unknown };
    }[];
    expect(batch.basis.targets["2"]).toMatchObject({ universities: 1 });
    expect(batch.basis.limits).toEqual(ASSIGNMENT_LIMITS);
  });

  it("basis 에 모델이 무엇을 보고 그랬는지 남는다", async () => {
    await persistProposalBatch(input());

    const [batch] = rowsFor("assignment_proposal_batches") as {
      basis: Record<string, unknown>;
    }[];
    expect(batch.basis).toMatchObject({
      model: "claude-opus-5",
      prompt_hash: "abc123",
      verdict_raw: '{"moves":[]}',
    });
  });

  it("탈락 줄이 basis 에 남는다 — 통과만 담으면 왜 3건뿐인지 모른다", async () => {
    await persistProposalBatch(
      input({
        gateResult: gateResult({
          rejected: [{ move: move(), gate: "G4", reason: "갈린 대학" }],
        }),
      }),
    );

    const [batch] = rowsFor("assignment_proposal_batches") as {
      basis: { rejected: { gate: string; reason: string }[] };
    }[];
    expect(batch.basis.rejected).toEqual([
      expect.objectContaining({
        gate: "G4",
        reason: "갈린 대학",
        university_name: "가대",
        work_kind: "원서접수",
      }),
    ]);
  });

  it("한 이동이 하위유형마다 한 줄이 된다 — 원장 자연키가 그렇다", async () => {
    const r = await persistProposalBatch(input());

    const rows = rowsFor("assignment_proposals") as { subtype: string }[];
    expect(rows.map((x) => x.subtype).sort()).toEqual(["수시", "정시"]);
    expect(r).toMatchObject({ proposals: 2 });
  });

  it("개발 칸은 제안에 안 담는다 — 배정은 운영 칸이다", async () => {
    await persistProposalBatch(input());

    const rows = rowsFor("assignment_proposals") as { role: string }[];
    expect(rows.every((x) => x.role === "운영")).toBe(true);
  });

  it("제안 한 줄에 근거와 이전 담당자가 들어간다", async () => {
    await persistProposalBatch(input());

    expect(rowsFor("assignment_proposals")[0]).toMatchObject({
      batch_id: "b1",
      academic_year: 2027,
      university_name: "가대",
      work_kind: "원서접수",
      prev_assignee: "a@x.com",
      next_assignee: "b@x.com",
      reason: "2그룹 평균보다 많다",
    });
  });

  it("통과가 없으면 제안 적재를 아예 부르지 않는다 — 빈 insert 는 오류다", async () => {
    const r = await persistProposalBatch(
      input({ gateResult: gateResult({ accepted: [] }) }),
    );

    expect(rowsFor("assignment_proposals")).toEqual([]);
    expect(r).toMatchObject({ ok: true, proposals: 0 });
  });

  it("원장에 없는 이동은 제안 줄을 못 만든다 — 그대로 말한다", async () => {
    const r = await persistProposalBatch(
      input({
        gateResult: gateResult({
          accepted: [move({ university_name: "없는대" })],
        }),
      }),
    );

    expect(r).toMatchObject({ ok: false });
    expect(r.ok === false && r.error).toMatch(/없는대/);
  });

  it("배치 적재가 실패하면 제안을 넣지 않는다", async () => {
    state.batchError = { message: "23514" };
    state.batchId = null;

    const r = await persistProposalBatch(input());

    expect(r).toMatchObject({ ok: false });
    expect(rowsFor("assignment_proposals")).toEqual([]);
  });

  it("배치는 들어갔는데 제안이 실패하면 그것을 구분해 말한다", async () => {
    // 트랜잭션이 없으므로 반쪽 상태가 생긴다. '실패' 로만 말하면 관리자가 다시
    // 돌리고 빈 배치가 둘 쌓인다.
    state.proposalsError = { message: "23503" };

    const r = await persistProposalBatch(input());

    expect(r).toMatchObject({ ok: false });
    expect(r.ok === false && r.error).toMatch(/배치.*제안|제안.*적재/);
    expect(r.ok === false && r.error).toMatch(/b1/);
  });
});
