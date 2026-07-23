import { describe, it, expect } from "vitest";
import {
  aggregateContracts,
  nextWeekdayRange,
  groupScheduleInRange,
  buildBriefingTeaserHtml,
  eventDateLabel,
  groupClosingByDate,
  summarizeAiWork,
  summarizeTips,
  summarizeInsights,
  fmtHours,
  fmtViews,
  upcomingAnniversaries,
  upcomingBirthdays,
  pickFeatureIntros,
  FEATURE_INTROS,
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

describe("buildBriefingTeaserHtml", () => {
  const contracts = {
    bySheet: [{ sheet: "4년제", done: 3, ongoing: 1 }],
    totalDone: 3,
    totalOngoing: 1,
  };
  const base = {
    issueNo: 12,
    dateLabel: "2026-07-17 (금)",
    contracts,
    closing: [
      {
        university_name: "건국대",
        service_name: "수시",
        pay_end_at: "2026-07-20T00:00:00+09:00",
        operator_name: null,
      },
    ],
    aiWork: { count: 5, totalCount: 5, savedHours: 12, items: [], more: 0 },
    tips: { newCount: 2, totalCount: 30, items: [], more: 0 },
    url: "https://ops.example.com/r/briefing/tok123",
  };

  it("제호(호수·날짜) + 핵심 수치 + 뉴스레터 링크", () => {
    const html = buildBriefingTeaserHtml(base);
    expect(html).toContain("[운영부 주간 브리핑] #12");
    expect(html).toContain("2026-07-17 (금)");
    expect(html).toContain("완료 3");
    expect(html).toContain("진행중 1");
    expect(html).toContain("마감 임박 1건");
    expect(html).toContain("AI 작업 5건");
    expect(html).toContain("절감 12h");
    expect(html).toContain("신규 TIP 2건");
    expect(html).toContain(
      '<a href="https://ops.example.com/r/briefing/tok123">',
    );
    expect(html).toContain("뉴스레터 전체 보기");
  });

  it("절감 0시간이면 절감 표기 생략", () => {
    const html = buildBriefingTeaserHtml({
      ...base,
      aiWork: { count: 0, totalCount: 0, savedHours: 0, items: [], more: 0 },
    });
    expect(html).not.toContain("절감");
  });

  it("headline이 있으면 캐치 제목이 첫 줄, 제호는 둘째 줄로", () => {
    const html = buildBriefingTeaserHtml({
      ...base,
      headline: "계약 340건 돌파! 이번 주 운영부가 해낸 일들",
    });
    expect(html).toContain("📰 계약 340건 돌파! 이번 주 운영부가 해낸 일들");
    expect(html).toContain("운영부 주간 브리핑 #12 · 2026-07-17 (금)");
  });
});

describe("fmtHours", () => {
  it("정수는 그대로, 소수는 1자리 반올림", () => {
    expect(fmtHours(3)).toBe("3");
    expect(fmtHours(12.5)).toBe("12.5");
    expect(fmtHours(1.25)).toBe("1.3");
    expect(fmtHours(0)).toBe("0");
  });
});

describe("summarizeAiWork", () => {
  const row = (title: string, saved: number | null) => ({
    title,
    ai_tool: "claude",
    author_name: "김OO",
    saved_hours: saved,
  });

  it("신규 건수·절감시간 합계(null 제외) + 누적 + 목록", () => {
    const s = summarizeAiWork([row("a", 3), row("b", 1.5), row("c", null)], 12);
    expect(s.count).toBe(3);
    expect(s.totalCount).toBe(12);
    expect(s.savedHours).toBe(4.5);
    expect(s.items).toHaveLength(3);
    expect(s.more).toBe(0);
  });

  it("5건 초과 시 앞 5건만 + more에 초과 건수", () => {
    const s = summarizeAiWork(
      Array.from({ length: 7 }, (_, i) => row(`t${i}`, 1)),
      20,
    );
    expect(s.items).toHaveLength(5);
    expect(s.more).toBe(2);
    expect(s.count).toBe(7);
    expect(s.totalCount).toBe(20);
  });
});

describe("summarizeTips", () => {
  const tip = (title: string) => ({
    title,
    ai_tool: "chatgpt",
    author_name: "이OO",
  });

  it("신규/누적 건수 + 목록", () => {
    const s = summarizeTips([tip("팁A"), tip("팁B")], 47);
    expect(s.newCount).toBe(2);
    expect(s.totalCount).toBe(47);
    expect(s.items).toHaveLength(2);
    expect(s.more).toBe(0);
  });

  it("5건 초과 시 앞 5건만 + more", () => {
    const s = summarizeTips(
      Array.from({ length: 6 }, (_, i) => tip(`t${i}`)),
      50,
    );
    expect(s.items).toHaveLength(5);
    expect(s.more).toBe(1);
  });
});

describe("fmtViews", () => {
  it("1만 미만은 그대로, 이상은 만 단위 1자리(정수면 소수 생략)", () => {
    expect(fmtViews(9800)).toBe("9800");
    expect(fmtViews(123456)).toBe("12.3만");
    expect(fmtViews(1200000)).toBe("120만");
  });
});

describe("summarizeInsights", () => {
  const v = (title: string, views: number | null) => ({
    title,
    channel_title: "ch",
    view_count: views,
    url: `https://www.youtube.com/watch?v=${title}`,
  });

  it("조회수 상위 N건(기본 3) — null은 뒤로, newCount는 전체", () => {
    const s = summarizeInsights([
      v("a", 100),
      v("b", null),
      v("c", 900),
      v("d", 500),
      v("e", 300),
    ]);
    expect(s.newCount).toBe(5);
    expect(s.items.map((i) => i.title)).toEqual(["c", "d", "e"]);
  });
});

describe("upcomingAnniversaries", () => {
  const ops = [
    { name: "김유민", hired_at: "2025-07-20" },
    { name: "박시현", hired_at: "2016-07-22" },
    { name: "이전산", hired_at: "2020-09-01" }, // 윈도우 밖
    { name: "신입이", hired_at: "2026-07-21" }, // 올해 입사 — 0주년 제외
  ];

  it("발행일부터 7일 내 도래하는 입사 기념일만 (주년 계산·날짜 오름차순)", () => {
    const r = upcomingAnniversaries(ops, "2026-07-17");
    expect(r).toEqual([
      { name: "김유민", years: 1, dateYmd: "2026-07-20" },
      { name: "박시현", years: 10, dateYmd: "2026-07-22" },
    ]);
  });

  it("최근 지난 기념일(며칠 전 만 N년)도 포함 — 창 밖(수개월)은 제외", () => {
    // 전지은 케이스: 열흘 전 만 1년 → 포함
    const included = upcomingAnniversaries(
      [{ name: "전지은", hired_at: "2025-07-14" }],
      "2026-07-24",
    );
    expect(included).toEqual([
      { name: "전지은", years: 1, dateYmd: "2026-07-14" },
    ]);
    // 수개월 뒤 기념일 → 제외
    expect(
      upcomingAnniversaries([{ name: "먼사람", hired_at: "2020-11-01" }], "2026-07-24"),
    ).toEqual([]);
  });

  it("전체 연차 축하 — 마일스톤 아닌 해(2·6년)도 포함", () => {
    const r = upcomingAnniversaries(
      [
        { name: "2년차", hired_at: "2024-07-20" },
        { name: "6년차", hired_at: "2020-07-22" },
      ],
      "2026-07-17",
    );
    expect(r.map((m) => `${m.name}:${m.years}`)).toEqual([
      "2년차:2",
      "6년차:6",
    ]);
  });

  it("해당자 없으면 빈 배열", () => {
    expect(upcomingAnniversaries([], "2026-07-17")).toEqual([]);
  });
});

describe("pickFeatureIntros", () => {
  it("호수별로 서로 다른 count개 묶음 (1호=앞 3개, 2호=다음 3개)", () => {
    expect(pickFeatureIntros(1, 3)).toEqual(FEATURE_INTROS.slice(0, 3));
    expect(pickFeatureIntros(2, 3)).toEqual(FEATURE_INTROS.slice(3, 6));
    expect(pickFeatureIntros(1, 3)).toHaveLength(3);
  });
});

describe("upcomingBirthdays", () => {
  const ops = [
    { name: "김유민", birth_date: "1995-07-20" },
    { name: "박시현", birth_date: "1988-07-23" },
    { name: "이전산", birth_date: "1990-09-01" }, // 윈도우 밖
  ];

  it("발행일부터 7일 내 생일(연도 무시) — 날짜 오름차순", () => {
    expect(upcomingBirthdays(ops, "2026-07-17")).toEqual([
      { name: "김유민", dateYmd: "2026-07-20" },
      { name: "박시현", dateYmd: "2026-07-23" },
    ]);
  });

  it("올해 생일이 지났으면 내년으로 — 윈도우 밖이면 제외", () => {
    expect(
      upcomingBirthdays([{ name: "김유민", birth_date: "1995-07-10" }], "2026-07-17"),
    ).toEqual([]);
  });

  it("birth_date 없거나 잘못된 형식은 무시", () => {
    expect(
      upcomingBirthdays(
        [
          { name: "a", birth_date: "" },
          { name: "b", birth_date: "invalid" },
        ],
        "2026-07-17",
      ),
    ).toEqual([]);
  });
});
