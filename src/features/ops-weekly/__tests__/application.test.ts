import { describe, expect, it } from "vitest";
import { freshDevStages } from "../dev-status";
import {
  buildApplicationGroups,
  countUnmatchedApplication,
  endsNextWeek,
  type AutoItem,
  type ClosingLite,
} from "../auto-lists/application";

const NOW = new Date("2026-11-18T01:00:00Z");

function c(
  id: number,
  operator: string | null,
  over: Partial<ClosingLite>,
): ClosingLite {
  return {
    service_id: id,
    university_name: `대학${id}`,
    service_name: `서비스${id}`,
    operator_name: operator,
    write_start_at: null,
    write_end_at: "2027-01-31T00:00:00Z",
    pay_end_at: null,
    ...over,
  };
}
const keys = (items: AutoItem[]) => items.map((i) => i.key);

const rows: ClosingLite[] = [
  c(1, "운영자A", { write_start_at: "2026-11-23T00:00:00Z" }),
  c(2, "운영자A", { write_start_at: "2026-11-22T15:30:00Z" }),
  c(3, "운영자A", {
    write_start_at: "2026-11-01T00:00:00Z",
    pay_end_at: "2026-12-31T00:00:00Z",
    write_end_at: "2026-11-25T08:00:00Z",
  }),
  c(4, "운영자A", {
    write_start_at: "2026-12-10T00:00:00Z",
    pay_end_at: "2026-12-20T00:00:00Z",
  }),
  c(5, null, { write_start_at: "2026-11-24T00:00:00Z" }),
  c(6, "퇴사자", { write_start_at: "2026-11-24T00:00:00Z" }),
  c(7, "운영자A ", {
    write_start_at: "2026-11-02T00:00:00Z",
    pay_end_at: "2026-12-31T00:00:00Z",
  }),
];

describe("buildApplicationGroups", () => {
  it("네 묶음 — KST 로 자른다, 겹치면 양쪽에 다 든다", () => {
    const g = buildApplicationGroups({
      rows,
      operatorName: "운영자A",
      devStages: new Map(),
      devStatusCollected: false,
      weekStart: "2026-11-16",
      now: NOW,
    });
    expect(keys(g.opening)).toEqual(["closing:2", "closing:1"]);
    expect(keys(g.running)).toEqual(["closing:3", "closing:7"]);
    expect(keys(g.closing)).toEqual(["closing:3"]);
    expect(keys(g.unknown)).toEqual(["closing:2", "closing:1", "closing:4"]);
    expect(g.devStatusCollected).toBe(false);
  });
  it("그 주에 수집된 구분만 dev/test 로 간다", () => {
    const fresh = freshDevStages(
      [{ service_id: 4, stage: "test", collected_at: "2026-11-16T00:00:00Z" }],
      "2026-11-16",
    );
    const g = buildApplicationGroups({
      rows,
      operatorName: "운영자A",
      devStages: fresh,
      devStatusCollected: true,
      weekStart: "2026-11-16",
      now: NOW,
    });
    expect(keys(g.test)).toEqual(["closing:4"]);
    expect(keys(g.unknown)).toEqual(["closing:2", "closing:1"]);
    expect(g.devStatusCollected).toBe(true);
  });
  it("수집 여부는 넘겨받은 값이다 — 본인 구분이 0건이어도 그 주에 수집됐으면 수집됨", () => {
    const g = buildApplicationGroups({
      rows,
      operatorName: "시작전없음",
      devStages: new Map(),
      devStatusCollected: true,
      weekStart: "2026-11-16",
      now: NOW,
    });
    expect(g.devStatusCollected).toBe(true);
    expect(g.dev).toEqual([]);
    expect(g.unknown).toEqual([]);
  });
  it("구분 행이 있어도 넘겨받은 값이 false 면 수집 안 됨", () => {
    const g = buildApplicationGroups({
      rows,
      operatorName: "운영자A",
      devStages: new Map([[4, "test" as const]]),
      devStatusCollected: false,
      weekStart: "2026-11-16",
      now: NOW,
    });
    expect(g.devStatusCollected).toBe(false);
  });
  it("미리 여는 다음 주는 그 주 월 00:00 기준으로 계산한다", () => {
    const g = buildApplicationGroups({
      rows,
      operatorName: "운영자A",
      devStages: new Map(),
      devStatusCollected: false,
      weekStart: "2026-11-23",
      now: new Date("2026-11-19T01:00:00Z"),
    });
    expect(keys(g.running)).toEqual(["closing:3", "closing:7"]);
    expect(keys(g.unknown)).toEqual(["closing:2", "closing:1", "closing:4"]);
    expect(g.opening).toEqual([]);
  });
  it("같은 시각이면 대학명 순, 마감 예정은 write_end_at 을 쓴다(pay_end_at 아님)", () => {
    const g = buildApplicationGroups({
      rows: [
        c(9, "운영자A", { write_start_at: "2026-11-01T00:00:00Z", write_end_at: "2026-11-26T00:00:00Z", pay_end_at: "2027-03-01T00:00:00Z", university_name: "나대" }),
        c(8, "운영자A", { write_start_at: "2026-11-01T00:00:00Z", write_end_at: "2026-11-26T00:00:00Z", pay_end_at: "2027-03-01T00:00:00Z", university_name: "가대" }),
        c(10, "운영자A", { write_start_at: "2026-11-01T00:00:00Z", write_end_at: "2027-01-01T00:00:00Z", pay_end_at: "2026-11-27T00:00:00Z" }),
      ],
      operatorName: "운영자A",
      devStages: new Map(),
      devStatusCollected: false,
      weekStart: "2026-11-16",
      now: NOW,
    });
    expect(keys(g.closing)).toEqual(["closing:8", "closing:9"]);
  });
});

describe("endsNextWeek", () => {
  it("KST 날짜로 차주 안인지 본다", () => {
    expect(endsNextWeek("2026-11-22T15:30:00Z", NOW)).toBe(true);
    expect(endsNextWeek("2026-11-22T14:59:00Z", NOW)).toBe(false);
  });
});

describe("countUnmatchedApplication", () => {
  it("안 붙음 — null·명단 밖 이름을 세고, 끝 공백은 맞춘다", () => {
    expect(
      countUnmatchedApplication({
        rows,
        writerNames: new Set(["운영자A"]),
        weekStart: "2026-11-16",
        now: NOW,
      }),
    ).toBe(2);
  });
  it("빈 문자열도 안 붙음, 아무것도 없으면 0", () => {
    expect(
      countUnmatchedApplication({
        rows: [c(1, "  ", { write_start_at: "2026-11-23T00:00:00Z" })],
        writerNames: new Set(["운영자A"]),
        weekStart: "2026-11-16",
        now: NOW,
      }),
    ).toBe(1);
    expect(
      countUnmatchedApplication({
        rows: [],
        writerNames: new Set(),
        weekStart: "2026-11-16",
        now: NOW,
      }),
    ).toBe(0);
  });
});
