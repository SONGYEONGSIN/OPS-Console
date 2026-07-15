import { describe, it, expect } from "vitest";
import { buildDevControlRows } from "../dev-control-rows";
import type { TestableService } from "@/features/entertest/queries";
import type { DevControlAnalysis } from "@/features/dev-controls/schemas";

function makeService(
  overrides: Partial<TestableService> = {},
): TestableService {
  return {
    service_id: 1,
    university_name: "가나대학교",
    service_name: "2027 수시",
    category: null,
    region: null,
    university_type: null,
    admission_type: null,
    operator_name: "홍길동",
    write_start_at: null,
    write_end_at: null,
    pay_start_at: null,
    pay_end_at: null,
    ...overrides,
  };
}

function makeAnalysis(
  overrides: Partial<DevControlAnalysis> = {},
): DevControlAnalysis {
  return {
    id: "a1",
    service_id: 1,
    file_name: "Apply1_A.js",
    gen_flag: "gen",
    kind: "A",
    code_hash: "hash",
    raw_code: "code",
    summary_md: null,
    flags: [
      {
        key: "k1",
        label: "L1",
        snippet: "",
        severity: "warn",
        checked: false,
        note: "",
      },
    ],
    analyzed_at: "2026-07-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("buildDevControlRows", () => {
  it("분석 있는 서비스는 여러 파일을 하나의 행으로 그룹핑한다", () => {
    const services = [makeService({ service_id: 1 })];
    const analyses = [
      makeAnalysis({ id: "a1", service_id: 1, file_name: "Apply1_A.js" }),
      makeAnalysis({
        id: "a2",
        service_id: 1,
        file_name: "Apply1_AU.js",
        kind: "AU",
      }),
    ];

    const rows = buildDevControlRows(services, analyses);

    expect(rows).toHaveLength(1);
    expect(rows[0].id).toBe("1");
    expect(rows[0].devControlAnalyses).toHaveLength(2);
    expect(rows[0].devControlAnalyses?.map((a) => a.id)).toEqual(["a1", "a2"]);
  });

  it("분석 없는 서비스도 빈 배열로 포함하고 분석 있는 서비스 뒤로 정렬한다", () => {
    const services = [
      makeService({ service_id: 1, university_name: "미수집대" }),
      makeService({ service_id: 2, university_name: "수집대" }),
    ];
    const analyses = [makeAnalysis({ id: "a1", service_id: 2 })];

    const rows = buildDevControlRows(services, analyses);

    expect(rows).toHaveLength(2);
    expect(rows.map((r) => r.id)).toEqual(["2", "1"]);
    expect(rows[0].devControlAnalyses).toHaveLength(1);
    expect(rows[1].devControlAnalyses).toEqual([]);
  });

  it("analyzed_at 최신순 정렬 + flags는 원본 그대로 전달된다(미확인 건수 계산은 Table 책임)", () => {
    const services = [
      makeService({ service_id: 1, university_name: "오래된대" }),
      makeService({ service_id: 2, university_name: "최근대" }),
    ];
    const oldFlags = [
      {
        key: "k1",
        label: "L1",
        snippet: "",
        severity: "warn" as const,
        checked: false,
        note: "",
      },
      {
        key: "k2",
        label: "L2",
        snippet: "",
        severity: "info" as const,
        checked: true,
        note: "메모",
      },
    ];
    const analyses = [
      makeAnalysis({
        id: "a1",
        service_id: 1,
        analyzed_at: "2026-07-01T00:00:00.000Z",
        flags: oldFlags,
      }),
      makeAnalysis({
        id: "a2",
        service_id: 2,
        analyzed_at: "2026-07-05T00:00:00.000Z",
      }),
    ];

    const rows = buildDevControlRows(services, analyses);

    expect(rows.map((r) => r.id)).toEqual(["2", "1"]);
    // 원본 flags 배열이 가공 없이 그대로 전달됨 — checked/미확인 건수 계산은 Table 책임
    expect(rows[1].devControlAnalyses?.[0].flags).toEqual(oldFlags);
  });
});
