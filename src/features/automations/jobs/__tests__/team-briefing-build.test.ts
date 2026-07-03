import { describe, it, expect } from "vitest";
import {
  aggregateContracts,
  nextWeekdayRange,
  groupScheduleInRange,
  buildBriefingHtml,
  eventDateLabel,
  groupClosingByDate,
  type ScheduleGroup,
} from "../team-briefing-build";

const SHEETS = ["4년제", "전문대", "초중고", "대학원", "기타"] as const;

describe("aggregateContracts", () => {
  it("완료 = '계약완료' 접두(접미사 포함), 그 외는 진행중", () => {
    const rows = [
      { sheet: "4년제", status: "계약완료" },
      { sheet: "4년제", status: "계약완료(영업)" }, // 접미사도 완료
      { sheet: "4년제", status: "메일발송" }, // 완료 아님 → 진행중
      { sheet: "전문대", status: "계약완료(운영)" },
      { sheet: "기타", status: "진행" },
    ];
    const r = aggregateContracts(rows, SHEETS);
    const byName = Object.fromEntries(r.bySheet.map((s) => [s.sheet, s]));
    expect(byName["4년제"]).toEqual({ sheet: "4년제", done: 2, ongoing: 1 });
    expect(byName["전문대"]).toEqual({ sheet: "전문대", done: 1, ongoing: 0 });
    expect(byName["기타"]).toEqual({ sheet: "기타", done: 0, ongoing: 1 });
    expect(r.totalDone).toBe(3);
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

describe("eventDateLabel", () => {
  const base = { type: "leave", title: "x", all_day: true };
  it("단일일은 MM-DD", () => {
    expect(
      eventDateLabel({ ...base, start_at: "2026-07-06T00:00:00+09:00" }),
    ).toBe("07-06");
  });
  it("같은 달 다중일은 MM-DD~DD", () => {
    expect(
      eventDateLabel({
        ...base,
        start_at: "2026-07-06T00:00:00+09:00",
        end_at: "2026-07-10T00:00:00+09:00",
      }),
    ).toBe("07-06~10");
  });
  it("다른 달 다중일은 MM-DD~MM-DD", () => {
    expect(
      eventDateLabel({
        ...base,
        start_at: "2026-07-30T00:00:00+09:00",
        end_at: "2026-08-02T00:00:00+09:00",
      }),
    ).toBe("07-30~08-02");
  });
});

describe("groupScheduleInRange", () => {
  it("범위 내 일정만 유형별 그룹(범위 밖 제외)", () => {
    const events = [
      {
        type: "shift",
        title: "A 근무",
        start_at: "2026-07-06T00:00:00+09:00",
        all_day: true,
      },
      {
        type: "leave",
        title: "B 휴가",
        start_at: "2026-07-08T00:00:00+09:00",
        all_day: true,
      },
      {
        type: "shift",
        title: "C 근무",
        start_at: "2026-07-07T00:00:00+09:00",
        all_day: true,
      },
      {
        type: "shift",
        title: "범위밖",
        start_at: "2026-07-20T00:00:00+09:00",
        all_day: true,
      },
    ];
    const g = groupScheduleInRange(events, "2026-07-06", "2026-07-10");
    const shift = g.find((x) => x.type === "shift");
    expect(shift?.items.map((i) => i.title)).toEqual(["A 근무", "C 근무"]);
    expect(g.find((x) => x.type === "leave")?.items).toHaveLength(1);
    // 범위 밖 이벤트는 제외되어 shift 3개가 아니라 2개
    expect(shift?.items).toHaveLength(2);
  });
});

describe("groupClosingByDate", () => {
  it("마감일별로 묶어 날짜 오름차순", () => {
    const g = groupClosingByDate([
      {
        university_name: "A대",
        service_name: "s1",
        pay_end_at: "2026-07-03T07:00:00+09:00",
        operator_name: "김",
      },
      {
        university_name: "B대",
        service_name: "s2",
        pay_end_at: "2026-07-01T07:00:00+09:00",
        operator_name: "이",
      },
      {
        university_name: "C대",
        service_name: "s3",
        pay_end_at: "2026-07-03T07:00:00+09:00",
        operator_name: "박",
      },
    ]);
    expect(g.map((x) => x.date)).toEqual(["2026-07-01", "2026-07-03"]);
    expect(g[1].items.map((i) => i.university_name)).toEqual(["A대", "C대"]);
  });
});

describe("buildBriefingHtml", () => {
  it("마감은 날짜별 그룹(헤더 [MM-DD] N건)으로 렌더", () => {
    const html = buildBriefingHtml({
      dateLabel: "2026-07-01",
      contracts: { bySheet: [], totalDone: 0, totalOngoing: 0 },
      weekRange: { startYmd: "2026-07-06", endYmd: "2026-07-10" },
      schedule: [],
      closing: [
        {
          university_name: "가천대",
          service_name: "외국인 3차",
          pay_end_at: "2026-07-01T07:00:00+09:00",
          operator_name: "김유민",
        },
        {
          university_name: "단국대",
          service_name: "후기",
          pay_end_at: "2026-07-03T07:00:00+09:00",
          operator_name: "정윤나",
        },
      ],
    });
    expect(html).toContain("· 총 2건");
    expect(html).toContain("[07-01] 1건");
    expect(html).toContain("[07-03] 1건");
    expect(html).toContain("가천대 외국인 3차 (김유민)");
  });

  it("두 섹션 제목 + 계약 합계 + 마감임박 항목 포함, 제목 escape", () => {
    const schedule: ScheduleGroup[] = [
      {
        type: "shift",
        label: "근무",
        items: [
          {
            type: "shift",
            title: "A<>&",
            start_at: "2026-07-06T00:00:00+09:00",
            all_day: true,
          },
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
    expect(html).toContain("계약현황");
    // 완료 % — 4년제 1/(1+2)=33.3% + 총 개수 3
    expect(html).toContain("완료 33.3%");
    expect(html).toContain("총 3 · 완료 1 · 진행중 2");
    expect(html).toContain("차주 팀 업무 현황");
    expect(html).toContain("건국대");
    expect(html).toContain("수시");
    // escape 적용
    expect(html).toContain("A&lt;&gt;&amp;");
    expect(html).not.toContain("A<>&");
  });

  it("마감 그룹이 10건 초과면 헤더 '10건+ (전체 N건)' + 앞 10건만 노출", () => {
    const closing = Array.from({ length: 13 }, (_, i) => ({
      university_name: `대학${i}`,
      service_name: "s",
      pay_end_at: "2026-07-03T07:00:00+09:00",
      operator_name: "김",
    }));
    const html = buildBriefingHtml({
      dateLabel: "2026-07-01",
      contracts: { bySheet: [], totalDone: 0, totalOngoing: 0 },
      weekRange: { startYmd: "2026-07-06", endYmd: "2026-07-10" },
      schedule: [],
      closing,
    });
    expect(html).toContain("[07-03] 10건+ (전체 13건)"); // 캡 라벨에 전체 개수
    expect(html).toContain("· 총 13건"); // 총계는 실제 건수
    expect(html).toContain("대학9"); // 10번째(index 9)까지 노출
    expect(html).not.toContain("대학10"); // 11번째부터 생략
  });
});
