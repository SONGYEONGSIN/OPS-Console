import { describe, it, expect } from "vitest";
import { summarizeBySheet, SHEET_SUMMARY_KINDS } from "../sheet-summary";
import { workKey, type WorkloadCell, type WorkloadOperator } from "../workload";

/**
 * 시트별 현황 — **"이 295곳이 어느 시트의 것이냐"** 에 답하는 자리(사용자 요구
 * 2026-09-22).
 *
 * 카드 하나로는 배정리스트 293곳과 성적산출 44곳이 한 덩어리로 보여, 어느 시트를
 * 손봐야 하는지 화면에서 읽을 수 없었다.
 *
 * **행의 합은 합계와 다르다.** 한 대학이 원서접수·PIMS·성적산출에 동시에 걸려
 * 있어(실측 2026-09-22: 행의 합 467곳 ↔ 중복 제거 295곳), 합계 줄은 그 사실을
 * 적는다. 여기서 합을 맞추려고 대학을 한 시트에만 넣으면 그 대학의 다른 업무가
 * 화면에서 사라진다.
 */
const op = (email: string, assignable = true): WorkloadOperator => ({
  email,
  name: email,
  assignable,
  hired_at: "2020-01-02",
});
const cell = (
  university_name: string,
  work_kind: string,
  assignee_email: string | null,
): WorkloadCell => ({ university_name, work_kind, assignee_email });

/** 키를 **`workKey` 로 만든다** — 손으로 적으면 키 모양이 바뀌는 날 조용히 갈린다. */
const counts = (
  ...pairs: [{ university_name: string; work_kind: string }, number][]
) => Object.fromEntries(pairs.map(([v, n]) => [workKey(v), n]));

describe("summarizeBySheet", () => {
  it("업무종류를 시트 이름으로 부른다 — 사람이 여는 것은 시트다", () => {
    const rows = summarizeBySheet({
      operators: [op("a@x.com")],
      cells: [cell("가대", "원서접수", "a@x.com")],
      serviceCounts: {},
    });

    expect(rows[0].sheet).toBe("02. 배정리스트");
  });

  it("시트 번호 순으로 선다 — 총괄장을 펼친 순서 그대로다", () => {
    const rows = summarizeBySheet({
      operators: [],
      cells: [],
      serviceCounts: {},
    });

    expect(rows.map((r) => r.sheet)).toEqual([
      "02. 배정리스트",
      "03. 대학원",
      "04. PIMS",
      "06. 성적산출",
    ]);
  });

  it("상담앱은 행으로 안 선다", () => {
    /*
     * 사용자 지시 2026-09-22. 원장 칸 25개는 그대로 남고 담당 대학 합계에도
     * 들어간다 — 합계는 원장 전체의 중복 제거라, 이 표에서 뺀다고 사라지지 않는다.
     */
    const rows = summarizeBySheet({
      operators: [op("a@x.com")],
      cells: [cell("가대", "상담앱", "a@x.com")],
      serviceCounts: {},
    });

    expect(rows.map((r) => r.kind)).not.toContain("상담앱");
    expect(SHEET_SUMMARY_KINDS).not.toContain("상담앱");
  });

  it("한 대학의 여러 칸은 그 시트에서 한 곳이다", () => {
    // 수시·정시가 따로 줄을 이루지만 담당 대학은 한 곳이다.
    const rows = summarizeBySheet({
      operators: [op("a@x.com")],
      cells: [
        cell("가대", "원서접수", "a@x.com"),
        cell("가대", "원서접수", "a@x.com"),
      ],
      serviceCounts: {},
    });

    expect(rows[0].universities).toBe(1);
  });

  it("같은 대학이 여러 시트에 걸리면 시트마다 센다", () => {
    /*
     * 행의 합(2)과 담당 대학 합계(1)가 달라지는 지점이다. 화면의 합계 줄이
     * `summary` 를 그대로 쓰는 이유이기도 하다 — 여기서 다시 세면 두 값이 갈린다.
     */
    const rows = summarizeBySheet({
      operators: [op("a@x.com")],
      cells: [
        cell("가대", "원서접수", "a@x.com"),
        cell("가대", "PIMS", "a@x.com"),
      ],
      serviceCounts: {},
    });

    expect(rows.find((r) => r.kind === "원서접수")!.universities).toBe(1);
    expect(rows.find((r) => r.kind === "PIMS")!.universities).toBe(1);
  });

  it("배정 대상이 아닌 사람의 칸은 안 센다 — 표와 같은 기준이어야 한다", () => {
    const rows = summarizeBySheet({
      operators: [op("팀장@x.com", false)],
      cells: [cell("가대", "원서접수", "팀장@x.com")],
      serviceCounts: {},
    });

    expect(rows[0].universities).toBe(0);
  });

  it("이메일이 안 붙은 칸은 담당이 아니다", () => {
    const rows = summarizeBySheet({
      operators: [op("a@x.com")],
      cells: [cell("가대", "원서접수", null)],
      serviceCounts: {},
    });

    expect(rows[0].universities).toBe(0);
  });

  it("건수는 그 업무종류의 원천 총량이다 — 안 붙은 것도 든다", () => {
    /*
     * 합계 줄이 `서비스 물량`(원천 총량)과 같아야 하므로, 시트별 건수도 붙었는지와
     * 무관하게 센다. 붙은 것만 세면 행의 합이 합계보다 작아지고, 그 차이가
     * `안 붙음` 카드와 겹쳐 같은 사실을 두 군데서 다르게 말한다.
     */
    const rows = summarizeBySheet({
      operators: [op("a@x.com")],
      cells: [cell("가대", "원서접수", "a@x.com")],
      serviceCounts: counts(
        [{ university_name: "가대", work_kind: "원서접수" }, 5],
        [{ university_name: "안붙은대", work_kind: "원서접수" }, 2],
      ),
    });

    expect(rows[0].services).toBe(7);
  });

  it("원천이 그 업무를 아예 안 들면 0 이 아니라 '못 셈' 이다", () => {
    /*
     * 성적산출 44곳은 마감에도 발표에도 없다. 0 으로 적으면 '일이 없다' 로 읽히고,
     * 그 44곳이 아무 일도 안 하는 것처럼 보인다.
     */
    const rows = summarizeBySheet({
      operators: [op("a@x.com")],
      cells: [cell("가대", "성적산출", "a@x.com")],
      serviceCounts: {},
    });

    expect(rows.find((r) => r.kind === "성적산출")!.services).toBeNull();
  });
});
