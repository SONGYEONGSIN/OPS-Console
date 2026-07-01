import { describe, it, expect } from "vitest";
import {
  aggregateContracts,
  nextWeekdayRange,
  groupScheduleInRange,
  buildBriefingHtml,
  type ScheduleGroup,
} from "../team-briefing-build";

const SHEETS = ["4년제", "전문대", "초중고", "대학원", "기타"] as const;

describe("aggregateContracts", () => {
  it("시트별 완료/진행중 카운트 + 합계 (진행중 = status가 계약완료가 아닌 행)", () => {
    const rows = [
      { sheet: "4년제", status: "계약완료" },
      { sheet: "4년제", status: "" },
      { sheet: "전문대", status: "계약완료" },
      { sheet: "기타", status: "진행" },
    ];
    const r = aggregateContracts(rows, SHEETS);
    const byName = Object.fromEntries(r.bySheet.map((s) => [s.sheet, s]));
    expect(byName["4년제"]).toEqual({ sheet: "4년제", done: 1, ongoing: 1 });
    expect(byName["전문대"]).toEqual({ sheet: "전문대", done: 1, ongoing: 0 });
    expect(byName["기타"]).toEqual({ sheet: "기타", done: 0, ongoing: 1 });
    expect(r.totalDone).toBe(2);
    expect(r.totalOngoing).toBe(2);
    // 5개 시트 모두 순서대로 포함
    expect(r.bySheet.map((s) => s.sheet)).toEqual([...SHEETS]);
  });
});

describe("nextWeekdayRange", () => {
  it("금요일 기준 다음주 월~금 반환", () => {
    // 2026-07-03 is Friday
    expect(nextWeekdayRange("2026-07-03")).toEqual({
      startYmd: "2026-07-06", // 다음주 월
      endYmd: "2026-07-10", // 다음주 금
    });
  });
  it("월요일 기준에도 다음주 월~금(당주 아님)", () => {
    // 2026-07-06 is Monday
    expect(nextWeekdayRange("2026-07-06")).toEqual({
      startYmd: "2026-07-13",
      endYmd: "2026-07-17",
    });
  });
});

describe("groupScheduleInRange", () => {
  it("범위 내 일정만 유형별 그룹(범위 밖 제외)", () => {
    const events = [
      { type: "shift", title: "A 근무", start_at: "2026-07-06T00:00:00+09:00", all_day: true },
      { type: "leave", title: "B 휴가", start_at: "2026-07-08T00:00:00+09:00", all_day: true },
      { type: "shift", title: "C 근무", start_at: "2026-07-07T00:00:00+09:00", all_day: true },
      { type: "shift", title: "범위밖", start_at: "2026-07-20T00:00:00+09:00", all_day: true },
    ];
    const g = groupScheduleInRange(events, "2026-07-06", "2026-07-10");
    const shift = g.find((x) => x.type === "shift");
    expect(shift?.items.map((i) => i.title)).toEqual(["A 근무", "C 근무"]);
    expect(g.find((x) => x.type === "leave")?.items).toHaveLength(1);
    // 범위 밖 이벤트는 제외되어 shift 3개가 아니라 2개
    expect(shift?.items).toHaveLength(2);
  });
});

describe("buildBriefingHtml", () => {
  it("두 섹션 제목 + 계약 합계 + 마감임박 항목 포함, 제목 escape", () => {
    const schedule: ScheduleGroup[] = [
      {
        type: "shift",
        label: "근무",
        items: [
          { type: "shift", title: "A<>&", start_at: "2026-07-06T00:00:00+09:00", all_day: true },
        ],
      },
    ];
    const html = buildBriefingHtml({
      dateLabel: "2026-07-03",
      contracts: {
        bySheet: [{ sheet: "4년제", done: 1, ongoing: 2 }],
        totalDone: 1,
        totalOngoing: 2,
      },
      weekRange: { startYmd: "2026-07-06", endYmd: "2026-07-10" },
      schedule,
      closing: [
        {
          university_name: "건국대",
          service_name: "수시",
          pay_end_at: "2026-07-05T07:00:00+09:00",
          operator_name: "송영신",
        },
      ],
    });
    expect(html).toContain("팀 보고 브리핑");
    expect(html).toContain("계약진행 현황");
    // 완료 % — 4년제 1/(1+2)=33.3% + 총 개수 3
    expect(html).toContain("완료 33.3%");
    expect(html).toContain("총 3 · 완료 1 · 진행중 2");
    expect(html).toContain("팀업무 현황");
    expect(html).toContain("건국대");
    expect(html).toContain("수시");
    // escape 적용
    expect(html).toContain("A&lt;&gt;&amp;");
    expect(html).not.toContain("A<>&");
  });
});
