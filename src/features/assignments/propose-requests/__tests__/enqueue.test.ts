import { describe, it, expect, vi, beforeEach } from "vitest";

const h = vi.hoisted(() => ({
  from: vi.fn(),
  select: vi.fn(),
  eq: vi.fn(),
  in: vi.fn(),
  limit: vi.fn(),
  update: vi.fn(),
  insert: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({ from: h.from }),
}));

import {
  enqueueProposeRequest,
  STALE_RUNNING_MS,
  AUTOMATION_REQUESTER,
} from "../enqueue";

/**
 * 판정 요청 적재 — 서버 잡이 부르고 회사 PC 폴러가 가져간다(§6.4).
 *
 * **같은 요청이 두 벌 쌓이는 것만 막는다.** 경쟁률 점검은 종류 무관 전역 1건인데
 * (Moa 로그인이 겹치면 세션이 충돌한다), 여기서 그 잠금을 쓰면 **미배정 감지가
 * 조용히 죽는다** — 평일마다 도는 잡이 pending 하나 때문에 아무것도 적재하지
 * 못하고, 두 번째 무주공산 서비스는 영영 판정되지 않는다. 판정은 Moa 를 타지 않아
 * 겹쳐도 되고, 막아야 하는 것은 **같은 판정의 중복**뿐이다(설계 §6.4 의 취지).
 */
const ANNUAL = { academicYear: 2027, kind: "annual" as const };
const SINGLE = {
  academicYear: 2027,
  kind: "single" as const,
  universityName: "가대",
  workKind: "원서접수",
};

const NOW = new Date("2026-09-18T10:00:00+09:00");

/**
 * 체인 목 — 메서드가 자기를 돌려주고, `await` 하면 **그 체인이 무엇이었나**(select /
 * update / insert)로 응답을 고른다.
 *
 * 순서 큐로 두면 안 된다: 막는 행이 없을 때는 update 체인을 안 타므로 insert 가
 * update 의 응답을 집어 간다(처음 그렇게 썼다가 insert 실패 테스트가 초록이었다).
 */
function wire(blocking: unknown[] = [], insertError: string | null = null) {
  h.from.mockImplementation(() => {
    let verb = "select";
    const builder: Record<string, unknown> = {};
    for (const name of ["select", "eq", "in", "limit", "update", "insert"]) {
      builder[name] = (...args: unknown[]) => {
        (h as unknown as Record<string, (...a: unknown[]) => unknown>)[name](
          ...args,
        );
        if (name === "update" || name === "insert" || name === "select") {
          verb = name;
        }
        return builder;
      };
    }
    builder.then = (
      resolve: (v: unknown) => unknown,
      reject?: (e: unknown) => unknown,
    ) => {
      const result =
        verb === "select"
          ? { data: blocking, error: null }
          : verb === "insert"
            ? { error: insertError ? { message: insertError } : null }
            : { error: null };
      return Promise.resolve(result).then(resolve, reject);
    };
    return builder;
  });
}

describe("enqueueProposeRequest", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    wire();
  });

  it("pending 한 줄을 적재한다", async () => {
    const r = await enqueueProposeRequest(AUTOMATION_REQUESTER, ANNUAL, NOW);

    expect(r.ok).toBe(true);
    expect(h.from).toHaveBeenCalledWith("assignment_propose_requests");
    expect(h.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        requested_by: "automation",
        academic_year: 2027,
        kind: "annual",
        status: "pending",
      }),
    );
  });

  it("annual 은 대상 칸을 비운다 — check 제약이 거부한다", async () => {
    await enqueueProposeRequest(AUTOMATION_REQUESTER, ANNUAL, NOW);

    expect(h.insert).toHaveBeenCalledWith(
      expect.objectContaining({ university_name: null, work_kind: null }),
    );
  });

  it("단건은 대상을 싣는다", async () => {
    await enqueueProposeRequest("admin@x.com", SINGLE, NOW);

    expect(h.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: "single",
        university_name: "가대",
        work_kind: "원서접수",
        requested_by: "admin@x.com",
      }),
    );
  });

  it("같은 학년도의 annual 이 대기 중이면 막는다", async () => {
    wire([{ id: "r1", status: "pending", claimed_at: null }]);

    const r = await enqueueProposeRequest(AUTOMATION_REQUESTER, ANNUAL, NOW);

    expect(r.ok).toBe(false);
    expect(r.skipped).toBe(true);
    expect(h.insert).not.toHaveBeenCalled();
  });

  it("막는 조회는 학년도·종류로 좁힌다 — 전역 잠금이 아니다", async () => {
    await enqueueProposeRequest(AUTOMATION_REQUESTER, ANNUAL, NOW);

    expect(h.eq).toHaveBeenCalledWith("academic_year", 2027);
    expect(h.eq).toHaveBeenCalledWith("kind", "annual");
  });

  it("단건은 대상까지 좁힌다 — 다른 대학 요청을 막지 않는다", async () => {
    await enqueueProposeRequest("admin@x.com", SINGLE, NOW);

    expect(h.eq).toHaveBeenCalledWith("university_name", "가대");
    expect(h.eq).toHaveBeenCalledWith("work_kind", "원서접수");
  });

  it("STALE 을 넘긴 running 은 failed 로 마감하고 새로 받는다", async () => {
    // 폴러가 claim 만 하고 죽으면 running 이 영원히 남아 큐가 잠긴다
    // (closing_scrape_requests 가 2주간 그랬다).
    const claimedAt = new Date(NOW.getTime() - STALE_RUNNING_MS - 1000);
    wire([
      { id: "r1", status: "running", claimed_at: claimedAt.toISOString() },
    ]);

    const r = await enqueueProposeRequest(AUTOMATION_REQUESTER, ANNUAL, NOW);

    expect(h.update).toHaveBeenCalledWith(
      expect.objectContaining({ status: "failed" }),
    );
    // 여전히 running 일 때만 마감한다 — 폴러가 방금 보고했을 수 있다.
    expect(h.eq).toHaveBeenCalledWith("status", "running");
    expect(r.ok).toBe(true);
  });

  it("STALE 이 안 지난 running 은 막는다", async () => {
    const claimedAt = new Date(NOW.getTime() - 60_000);
    wire([
      { id: "r1", status: "running", claimed_at: claimedAt.toISOString() },
    ]);

    const r = await enqueueProposeRequest(AUTOMATION_REQUESTER, ANNUAL, NOW);

    expect(r.skipped).toBe(true);
    expect(h.insert).not.toHaveBeenCalled();
  });

  it("claimed_at 이 없는 running 은 막는다 — 언제부터인지 모른다", async () => {
    wire([{ id: "r1", status: "running", claimed_at: null }]);

    expect(
      (await enqueueProposeRequest(AUTOMATION_REQUESTER, ANNUAL, NOW)).skipped,
    ).toBe(true);
  });

  it("적재 실패는 실패로 돌려준다 — skipped 가 아니다", async () => {
    // skipped 는 '안 해도 되는 날' 이라 실패 집계에 안 들어간다. 진짜 실패를
    // 그쪽으로 보내면 연간 생성이 안 돼도 아무도 모른다.
    wire([], "23514");

    const r = await enqueueProposeRequest(AUTOMATION_REQUESTER, ANNUAL, NOW);

    expect(r).toMatchObject({ ok: false, skipped: false });
    expect(r.message).toMatch(/23514/);
  });

  it("접수 표식을 붙인다 — 이 줄이 '성공' 으로 읽히면 안 된다", async () => {
    const r = await enqueueProposeRequest(AUTOMATION_REQUESTER, ANNUAL, NOW);

    expect(r.message).toMatch(/회사 PC|폴러/);
  });
});
