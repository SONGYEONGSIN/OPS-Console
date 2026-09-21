import { describe, it, expect, vi, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { BAEJUNG_CURRENT_YEAR } from "@/features/assignments/parse";
import { SWEEP_MAX_ENQUEUE } from "@/features/assignments/proposal/unassigned";

/**
 * 미배정 감지(설계 §6.4) — 평일마다 원장을 훑어 **주인 없는 칸**을 판정으로 보낸다.
 */
const listLedgerRows = vi.fn();
const enqueueProposeRequest = vi.fn();

vi.mock("@/features/assignments/ledger-queries", () => ({
  listLedgerRows: (...a: unknown[]) => listLedgerRows(...a),
}));
vi.mock("@/features/assignments/propose-requests/enqueue", () => ({
  AUTOMATION_REQUESTER: "automation",
  enqueueProposeRequest: (...a: unknown[]) => enqueueProposeRequest(...a),
}));
const ADMIN = { __admin: true };
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ADMIN }));

const { runAssignmentUnassignedSweep } =
  await import("../assignment-unassigned-sweep");

const cell = (
  university_name: string,
  work_kind: string,
  assignee_email: string | null,
  assignee_name = "",
) => ({
  academic_year: BAEJUNG_CURRENT_YEAR,
  university_name,
  work_kind,
  subtype: "",
  role: "운영",
  assignee_email,
  assignee_name,
});

beforeEach(() => {
  vi.clearAllMocks();
  listLedgerRows.mockResolvedValue([]);
  enqueueProposeRequest.mockResolvedValue({
    ok: true,
    skipped: false,
    message: "요청을 큐에 넣었습니다",
  });
});

describe("runAssignmentUnassignedSweep", () => {
  it("주인 없는 칸을 건수로 알린다", async () => {
    listLedgerRows.mockResolvedValue([cell("가대", "원서접수", null)]);
    const r = await runAssignmentUnassignedSweep();
    expect(r.ok).toBe(true);
    expect(r.message).toMatch(/미배정 1곳/);
  });

  it("**화면과 같은 학년도**를 훑는다", async () => {
    // 잡이 시계에서 학년도를 도출하면 3월에 한 해를 건너뛰어, 화면엔 미배정 배지가
    // 떠 있는데 잡은 빈 원장을 보고 '미배정 없음' 을 보고한다.
    await runAssignmentUnassignedSweep();
    expect(listLedgerRows).toHaveBeenCalledWith(BAEJUNG_CURRENT_YEAR, ADMIN);
  });

  it("**원장을 admin 클라이언트로 읽는다 — 잡에는 세션이 없다**", async () => {
    /*
     * 실측(2026-09-18 라이브): `assignments` 의 select 정책이 `to authenticated` 라,
     * 세션 없는 클라이언트는 `count=null` 에 **코드도 메시지도 빈 에러**를 받는다.
     * rollover 가 같은 이유로 프로덕션에서 500 이 났다.
     */
    await runAssignmentUnassignedSweep();
    expect(listLedgerRows).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ __admin: true }),
    );
  });

  it("시계에서 학년도를 도출하지 않는다", () => {
    /*
     * 위 단언은 **오늘은 안 문다** — `currentAcademicYear(2026-09)` 도 2027 이라
     * 둘을 바꿔도 초록이고, 3월이 와야 갈린다. 그때는 이미 배포된 뒤다.
     * 그래서 원문으로 고정한다(`proxy-cron-paths.test.ts` 와 같은 방식).
     */
    const src = readFileSync(
      join(
        process.cwd(),
        "src/features/automations/jobs/assignment-unassigned-sweep.ts",
      ),
      "utf8",
    );
    // 주석에서 rollover 와 대비해 언급하는 것은 괜찮다 — 들여오는지를 본다.
    expect(src).not.toMatch(/import\s*\{[^}]*currentAcademicYear[^}]*\}/);
    expect(src).toMatch(/import\s*\{[^}]*BAEJUNG_CURRENT_YEAR[^}]*\}/);
  });

  it("미배정이 없으면 그렇게 보고한다", async () => {
    listLedgerRows.mockResolvedValue([cell("가대", "원서접수", "a@x.com")]);
    const r = await runAssignmentUnassignedSweep();
    expect(r.ok).toBe(true);
    expect(r.message).toMatch(/미배정 없음|미배정 0/);
    expect(enqueueProposeRequest).not.toHaveBeenCalled();
  });

  it("이름만 있는 칸은 요청하지 않고 건수로 알린다", async () => {
    listLedgerRows.mockResolvedValue([
      cell("가대", "원서접수", null, "김운영"),
    ]);
    const r = await runAssignmentUnassignedSweep();
    expect(enqueueProposeRequest).not.toHaveBeenCalled();
    expect(r.message).toMatch(/닿지 않은|연결 안 됨/);
    expect(r.message).toMatch(/1/);
  });

  it("원장 조회가 실패하면 실패로 끝난다 — 0건으로 읽지 않는다", async () => {
    listLedgerRows.mockRejectedValue(new Error("boom"));
    const r = await runAssignmentUnassignedSweep();
    expect(r.ok).toBe(false);
    expect(r.message).toMatch(/boom/);
  });
});

/**
 * **프로세스는 버튼이다**(설계 2026-09-21 요구 8 · 사용자 2026-09-20).
 *
 * 2027학년도 배정은 이미 끝났고, 지금 필요한 것은 모니터링이다 — *"내가 신규 서비스에
 * 대한 운영자 배정 요청이 없으면 굳이 제안해 줄 필요가 없음"*. 그래서 이 잡은 **감지와
 * 보고만** 하고 요청은 사람이 화면에서 만든다.
 *
 * 적재를 남겨 두면 제안 탭이 **아무도 요청하지 않은 단건 배치**로 차고, `requested_by`
 * 가 전부 `automation` 이라 누가 왜 만들었는지 사라진다.
 */
describe("runAssignmentUnassignedSweep — 감지·보고만 한다", () => {
  it("미배정이 있어도 판정 요청을 적재하지 않는다", async () => {
    listLedgerRows.mockResolvedValue([
      cell("가대", "원서접수", null),
      cell("나대", "대학원", null),
    ]);
    const r = await runAssignmentUnassignedSweep();
    expect(enqueueProposeRequest).not.toHaveBeenCalled();
    expect(r.ok).toBe(true);
  });

  it("미배정 건수를 그대로 보고한다 — 상한으로 깎지 않는다", async () => {
    // 적재를 안 하므로 `SWEEP_MAX_ENQUEUE` 상한도, 그 상한이 만든 '다음 실행이
    // 이어 간다' 도 함께 사라진다. 감지는 전건을 본다.
    const many = Array.from({ length: SWEEP_MAX_ENQUEUE + 7 }, (_, i) =>
      cell(`대학${String(i).padStart(2, "0")}`, "원서접수", null),
    );
    listLedgerRows.mockResolvedValue(many);
    const r = await runAssignmentUnassignedSweep();
    expect(r.message).toMatch(new RegExp(`${SWEEP_MAX_ENQUEUE + 7}`));
    expect(r.message).not.toMatch(/적재|다음 실행/);
  });

  it("어디를 배정해야 하는지 화면으로 안내한다", async () => {
    // 건수만 알리고 끝나면 '그래서 어디서 하나' 가 남는다.
    listLedgerRows.mockResolvedValue([cell("가대", "원서접수", null)]);
    const r = await runAssignmentUnassignedSweep();
    expect(r.message).toMatch(/업무배정/);
  });

  it("적재 모듈을 아예 들여오지 않는다", () => {
    /*
     * 호출만 지우면 다음 사람이 '왜 안 쓰지' 하고 되살린다. import 가 없으면
     * 되살리는 일이 의식적인 변경이 된다 — 원문으로 고정한다.
     */
    const src = readFileSync(
      join(
        process.cwd(),
        "src/features/automations/jobs/assignment-unassigned-sweep.ts",
      ),
      "utf8",
    ).replace(/\/\*[\s\S]*?\*\//g, "");
    expect(src).not.toMatch(/enqueueProposeRequest/);
  });
});
