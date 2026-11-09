import { describe, expect, it } from "vitest";
import {
  advancedWatermarks,
  completeBodySchema,
  FAILURE_COPY,
  failureCopy,
  finalStatus,
  mergeWatermarks,
  type RefreshResult,
  runMessage,
  type StepResult,
  stepLabel,
  stepResultSchema,
} from "../contract";

// zod 4 의 uuid() 는 RFC 형식(버전 니블)을 엄격히 본다.
const ID = "00000000-0000-4000-8000-000000000001";

function step(
  id: string,
  status: StepResult["status"],
  code: string | null = null,
  summary = "",
  extra: Partial<StepResult> = {},
): StepResult {
  return {
    step: id,
    status,
    summary,
    counts: {},
    error: code ? { code } : null,
    watermark: null,
    ...extra,
  };
}

function res(steps: StepResult[]): RefreshResult {
  return { version: 1, steps, changes: [] };
}

describe("현황 최신화 결과 계약", () => {
  it("모든 단계가 ok 여야 done", () => {
    expect(
      finalStatus({
        id: ID,
        ok: true,
        result: res([step("moa", "ok"), step("workbook", "ok")]),
      }),
    ).toBe("done");
    expect(
      finalStatus({
        id: ID,
        ok: false,
        result: res([
          step("moa", "failed", "lease_busy"),
          step("workbook", "ok"),
        ]),
      }),
    ).toBe("failed");
    expect(
      finalStatus({
        id: ID,
        ok: true,
        result: res([step("moa", "skipped", "dependency_failed")]),
      }),
    ).toBe("failed");
    expect(finalStatus({ id: ID, ok: true, result: res([]) })).toBe("failed");
    expect(finalStatus({ id: ID, ok: false })).toBe("failed");
  });

  it("모르는 단계·코드도 받는다", () => {
    const body = {
      id: ID,
      ok: false,
      result: {
        version: 1,
        changes: [],
        steps: [
          {
            step: "pdf",
            status: "failed",
            summary: "",
            counts: {},
            error: { code: "brand_new" },
            watermark: null,
          },
        ],
      },
    };
    expect(completeBodySchema.safeParse(body).success).toBe(true);
    expect(failureCopy("brand_new")).toBe(FAILURE_COPY.unknown);
    expect(stepLabel("pdf")).toBe("pdf");
  });

  it("412·423 은 사람이 할 일로", () => {
    expect(failureCopy("locked")).toBe(
      "누가 현황 파일을 열어 두었습니다. 닫고 다시 누르세요.",
    );
    expect(failureCopy("changed")).toBe(
      "그 사이 누가 현황 파일을 저장했습니다. 다시 누르면 새 파일로 처음부터 합니다.",
    );
  });

  it("PIMS 수집 단계는 라벨과 실패 문구가 있다", () => {
    expect(stepLabel("pims")).toBe("PIMS 수집");
    for (const code of [
      "pims_login_failed",
      "pims_empty",
      "pims_shape_changed",
      "pims_incomplete",
    ]) {
      expect(failureCopy(code)).not.toBe(FAILURE_COPY.unknown);
      expect(failureCopy(code)).toContain("PIMS");
    }
  });

  it("실행 메시지는 단계·성패·코드만 — summary·message 원문을 싣지 않는다", () => {
    expect(
      runMessage({
        id: ID,
        ok: false,
        result: res([
          step("moa", "ok", null, "010-0000-0001"),
          step("workbook", "failed", "locked"),
        ]),
      }),
    ).toBe("Moa 수집 성공 · 현황 파일 실패(locked)");
    expect(
      runMessage({
        id: ID,
        ok: false,
        message: "exit 1 — Traceback 010-0000-0001",
      }),
    ).toBe("회사 PC 처리 실패 — 결과 없음");
  });

  it("건너뜀도 단계 라벨로 적는다", () => {
    expect(
      runMessage({
        id: ID,
        ok: false,
        result: res([
          step("moa", "failed", "lease_busy"),
          step("workbook", "skipped", "dependency_failed"),
        ]),
      }),
    ).toBe("Moa 수집 실패(lease_busy) · 현황 파일 건너뜀");
  });

  it("watermark 는 ok 단계 것만, 키마다 가장 늦은 값", () => {
    expect(
      advancedWatermarks(
        res([
          step("mail", "ok", null, "", { watermark: "2026-11-07T01:00:00Z" }),
          step("pdf", "failed", "unknown", "", {
            watermark: "2026-11-07T02:00:00Z",
          }),
        ]),
      ),
    ).toEqual({ mail: "2026-11-07T01:00:00Z" });
    // 문자열로 비교하면 "+09:00" 쪽이 이긴다 — 실제로는 2026-11-01T15:00Z 라 20:00Z 가 더 늦다.
    expect(
      mergeWatermarks([
        { mail: "2026-11-01T20:00:00Z" },
        { mail: "2026-11-02T00:00:00+09:00", pdf: "2026-10-20T00:00:00Z" },
        {},
      ]),
    ).toEqual({ mail: "2026-11-01T20:00:00Z", pdf: "2026-10-20T00:00:00Z" });
  });

  it("읽을 수 없는 watermark 는 버린다", () => {
    expect(
      mergeWatermarks([
        { mail: "not-a-date" },
        { pdf: "2026-10-20T00:00:00Z" },
      ]),
    ).toEqual({ pdf: "2026-10-20T00:00:00Z" });
  });

  it("summary 300자 상한", () => {
    expect(
      stepResultSchema.safeParse({
        ...step("moa", "ok"),
        summary: "가".repeat(301),
      }).success,
    ).toBe(false);
  });
});
