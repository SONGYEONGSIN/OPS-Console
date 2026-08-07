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
  excludeSeenCelebrations,
  celebrationKey,
  pickAlbum,
  excludeSeenImages,
  ALBUM_MAX,
  pickSasiGoal,
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
    expect(html).toContain("[운영부 주간 브리핑] #012");
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
    expect(html).toContain("뉴스레터에서 전체 이야기 확인하기");
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
    expect(html).toContain("운영부 주간 브리핑 #012 · 2026-07-17 (금)");
  });

  it("teaser가 있으면 낚시 문구로 사용", () => {
    const html = buildBriefingTeaserHtml({
      ...base,
      teaser: "계약 절반의 문턱, 이번 주 무슨 일이? 👀",
    });
    expect(html).toContain("계약 절반의 문턱, 이번 주 무슨 일이? 👀");
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

  it("신규 건수·절감(신규 기준) + 목록은 최근 누적에서 채움", () => {
    const s = summarizeAiWork(
      [row("a", 3), row("b", 1.5)],
      [row("a", 3), row("b", 1.5), row("c", null), row("d", 2)],
      12,
    );
    expect(s.count).toBe(2); // 신규
    expect(s.totalCount).toBe(12);
    expect(s.savedHours).toBe(4.5); // 신규 절감(null 제외)
    expect(s.items).toHaveLength(3); // 최근 3건 표시(최대 3)
    expect(s.more).toBe(9); // 누적 12 - 표시 3
  });

  it("신규 0이어도 최근 누적으로 목록을 채운다", () => {
    const s = summarizeAiWork([], [row("x", 1), row("y", 2)], 2);
    expect(s.count).toBe(0);
    expect(s.savedHours).toBe(0);
    expect(s.items).toHaveLength(2); // 신규 0이어도 표시
    expect(s.more).toBe(0);
  });

  it("최근 3건 초과 시 앞 3건만", () => {
    const recent = Array.from({ length: 7 }, (_, i) => row(`t${i}`, 1));
    const s = summarizeAiWork([], recent, 20);
    expect(s.items).toHaveLength(3);
    expect(s.more).toBe(17); // 누적 20 - 표시 3
  });
});

describe("summarizeTips", () => {
  const tip = (title: string) => ({
    title,
    ai_tool: "chatgpt",
    author_name: "이OO",
  });

  it("신규/누적 건수 + 목록은 최근 누적에서 채움(신규 부족해도)", () => {
    const s = summarizeTips(
      [tip("팁A")],
      [tip("팁A"), tip("팁B"), tip("팁C")],
      47,
    );
    expect(s.newCount).toBe(1); // 신규 1
    expect(s.totalCount).toBe(47);
    expect(s.items).toHaveLength(3); // 최근 3건 표시
    expect(s.more).toBe(44); // 누적 47 - 표시 3
  });

  it("최근 3건 초과 시 앞 3건만", () => {
    const recent = Array.from({ length: 6 }, (_, i) => tip(`t${i}`));
    const s = summarizeTips([], recent, 50);
    expect(s.items).toHaveLength(3);
    expect(s.more).toBe(47);
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

  it("랜덤 최대 N건(기본 3) — newCount는 전체, items는 중복 없는 부분집합", () => {
    const rows = [
      v("a", 100),
      v("b", null),
      v("c", 900),
      v("d", 500),
      v("e", 300),
    ];
    const s = summarizeInsights(rows);
    expect(s.newCount).toBe(5);
    expect(s.items).toHaveLength(3);
    const titles = new Set(rows.map((r) => r.title));
    expect(s.items.every((i) => titles.has(i.title))).toBe(true);
    expect(new Set(s.items.map((i) => i.title)).size).toBe(3);
  });

  it("수집이 N개 미만이면 전체 반환", () => {
    const s = summarizeInsights([v("a", 1), v("b", 2)]);
    expect(s.items).toHaveLength(2);
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
      { name: "김유민", years: 1, dateYmd: "2026-07-20", isPast: false },
      { name: "박시현", years: 10, dateYmd: "2026-07-22", isPast: false },
    ]);
  });

  it("최근 지난 기념일도 포함하되 isPast:true로 표시 — 창 밖(수개월)은 제외", () => {
    // 전지은 케이스: 열흘 전 만 1년 → 포함, 과거라 isPast:true (렌더는 과거형)
    const included = upcomingAnniversaries(
      [{ name: "전지은", hired_at: "2025-07-14" }],
      "2026-07-24",
    );
    expect(included).toEqual([
      { name: "전지은", years: 1, dateYmd: "2026-07-14", isPast: true },
    ]);
    // 수개월 뒤 기념일 → 제외
    expect(
      upcomingAnniversaries(
        [{ name: "먼사람", hired_at: "2020-11-01" }],
        "2026-07-24",
      ),
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

describe("FEATURE_INTROS 카탈로그", () => {
  it("인수인계·사고보고가 앞 2건 (2호 소개 대상)", () => {
    expect(FEATURE_INTROS[0].menu).toContain("인수인계");
    expect(FEATURE_INTROS[1].menu).toContain("사고보고");
  });

  it("메뉴 중복 없음", () => {
    const menus = FEATURE_INTROS.map((f) => `${f.menu}|${f.title}`);
    expect(new Set(menus).size).toBe(menus.length);
  });
});

describe("pickFeatureIntros — 2호 앵커 순환", () => {
  it("2호는 인수인계·사고보고 2건만", () => {
    const r = pickFeatureIntros(2);
    expect(r).toEqual(FEATURE_INTROS.slice(0, 2));
    expect(r).toHaveLength(2);
  });

  it("3호는 핀으로 지정한 2건", () => {
    const r = pickFeatureIntros(3);
    expect(r.map((f) => f.title)).toEqual([
      "경쟁률 세팅 점검 자동화",
      "백업 요청 검색에 합격자통합관리 발표 서비스",
    ]);
  });

  it("4호는 그 다음 3건 — 이어서 진행", () => {
    expect(pickFeatureIntros(4)).toEqual(FEATURE_INTROS.slice(5, 8));
  });

  it("카탈로그 끝을 넘어가면 앞으로 순환", () => {
    const len = FEATURE_INTROS.length;
    const many = pickFeatureIntros(40);
    expect(many).toHaveLength(3);
    for (const f of many) expect(FEATURE_INTROS).toContain(f);
    expect(len).toBeGreaterThan(3);
  });

  it("count를 명시하면 그 개수를 따른다", () => {
    expect(pickFeatureIntros(3, 1)).toHaveLength(1);
  });
});

describe("excludeSeenCelebrations — 이미 발행된 호에 실린 기념일 제외", () => {
  const milestones = [
    { name: "김지영", years: 10, dateYmd: "2026-07-27", isPast: true },
    { name: "정윤나", years: 7, dateYmd: "2026-08-01", isPast: false },
  ];

  it("이미 실린 (이름+날짜)는 걸러낸다", () => {
    const seen = new Set([celebrationKey("ms", "김지영", "2026-07-27")]);
    expect(excludeSeenCelebrations(milestones, "ms", seen)).toEqual([
      milestones[1],
    ]);
  });

  it("같은 사람이라도 날짜(연차)가 다르면 남긴다", () => {
    const seen = new Set([celebrationKey("ms", "김지영", "2025-07-27")]);
    expect(excludeSeenCelebrations(milestones, "ms", seen)).toHaveLength(2);
  });

  it("종류(ms/bd)가 다르면 서로 간섭하지 않는다", () => {
    const seen = new Set([celebrationKey("bd", "김지영", "2026-07-27")]);
    expect(excludeSeenCelebrations(milestones, "ms", seen)).toHaveLength(2);
  });

  it("빈 seen이면 그대로 통과", () => {
    expect(excludeSeenCelebrations(milestones, "ms", new Set())).toEqual(
      milestones,
    );
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
      upcomingBirthdays(
        [{ name: "김유민", birth_date: "1995-07-10" }],
        "2026-07-17",
      ),
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

  // 주간 발행이므로 창이 7일을 넘으면 생일이 2주 전 호에 실린다. 그 호에 한 번 실리면
  // excludeSeenCelebrations가 이후 호에서 빼므로, 정작 생일에 가까운 호에는 안 나온다.
  it("8일 이상 남은 생일은 제외 — 다음 호가 맡는다", () => {
    expect(
      upcomingBirthdays(
        [{ name: "임종우", birth_date: "1990-08-20" }],
        "2026-08-07",
      ),
    ).toEqual([]);
  });

  it("7일 남은 생일은 포함 (경계)", () => {
    expect(
      upcomingBirthdays(
        [{ name: "임종우", birth_date: "1990-08-20" }],
        "2026-08-13",
      ),
    ).toEqual([{ name: "임종우", dateYmd: "2026-08-20" }]);
  });
});

describe("pickAlbum — 앨범 노출 상한", () => {
  const media = (n: number) =>
    Array.from({ length: n }, (_, i) => ({
      src: `https://cdn/p${i + 1}.jpg`,
      caption: `사진 ${i + 1}`,
    }));

  it("11장이면 커버 1 + 앨범 10 — 한 장도 잘리지 않는다", () => {
    const r = pickAlbum(media(11), []);
    expect(r!.cover!.caption).toBe("사진 1");
    expect(r!.gallery).toHaveLength(10);
    expect(r!.gallery!.at(-1)!.caption).toBe("사진 11");
  });

  it("상한을 넘으면 커버 포함 ALBUM_MAX장까지만", () => {
    const r = pickAlbum(media(ALBUM_MAX + 5), []);
    expect(r!.gallery).toHaveLength(ALBUM_MAX - 1);
  });

  it("영상은 최대 2건", () => {
    const r = pickAlbum(media(1), media(4));
    expect(r!.videos).toHaveLength(2);
  });

  it("사진·영상이 모두 없으면 undefined", () => {
    expect(pickAlbum([], [])).toBeUndefined();
  });

  it("영상만 있으면 커버 없이 영상만", () => {
    const r = pickAlbum([], media(1));
    expect(r!.cover).toBeUndefined();
    expect(r!.videos).toHaveLength(1);
  });

  it("coverSrc를 주면 그 사진이 커버 — 나머지는 원래 순서 유지", () => {
    const r = pickAlbum(media(4), [], "https://cdn/p3.jpg");
    expect(r!.cover!.caption).toBe("사진 3");
    expect(r!.gallery!.map((g) => g.caption)).toEqual([
      "사진 1",
      "사진 2",
      "사진 4",
    ]);
  });

  it("coverSrc가 목록에 없으면 기존대로 첫 장이 커버", () => {
    const r = pickAlbum(media(3), [], "https://cdn/없는사진.jpg");
    expect(r!.cover!.caption).toBe("사진 1");
    expect(r!.gallery!.map((g) => g.caption)).toEqual(["사진 2", "사진 3"]);
  });

  it("coverSrc가 이미 첫 장이면 순서가 바뀌지 않는다", () => {
    const r = pickAlbum(media(3), [], "https://cdn/p1.jpg");
    expect(r!.cover!.caption).toBe("사진 1");
    expect(r!.gallery!.map((g) => g.caption)).toEqual(["사진 2", "사진 3"]);
  });
});

describe("excludeSeenImages — 이전 호에 실린 사진 제외", () => {
  const media = (n: number) =>
    Array.from({ length: n }, (_, i) => ({
      src: `https://cdn/p${i + 1}.jpg`,
      caption: `사진 ${i + 1}`,
    }));

  it("이미 발행된 src는 뺀다", () => {
    const seen = new Set(["https://cdn/p1.jpg", "https://cdn/p3.jpg"]);
    expect(excludeSeenImages(media(4), seen).map((m) => m.caption)).toEqual([
      "사진 2",
      "사진 4",
    ]);
  });

  it("seen이 비어 있으면 그대로 통과", () => {
    expect(excludeSeenImages(media(3), new Set())).toHaveLength(3);
  });

  it("전부 발행됐으면 빈 배열 — 앨범 섹션이 사라진다", () => {
    const seen = new Set(media(3).map((m) => m.src));
    expect(excludeSeenImages(media(3), seen)).toEqual([]);
  });
});

describe("pickSasiGoal — 발행일이 속한 수시 주차", () => {
  it("8월 1주차 시작일(8/3)이면 개발 50%·테스트 20%", () => {
    const g = pickSasiGoal("2026-08-03");
    expect(g).toEqual({
      label: "8월 1주차",
      rangeLabel: "8/3~8/9",
      devTarget: "50%",
      testTarget: "20%",
      note: undefined,
      dDay: 35,
      applyStartLabel: "9/7(월)",
    });
  });

  it("주차 마지막 날(8/9)도 같은 주차", () => {
    expect(pickSasiGoal("2026-08-09")?.label).toBe("8월 1주차");
  });

  it("다음 날(8/10)은 다음 주차로 넘어간다", () => {
    const g = pickSasiGoal("2026-08-10");
    expect(g?.label).toBe("8월 2주차");
    expect(g?.devTarget).toBe("70%");
    expect(g?.testTarget).toBe("50%");
  });

  it("8월 4주차는 개발 목표가 없고 테스트 100%만", () => {
    const g = pickSasiGoal("2026-08-24");
    expect(g?.devTarget).toBeUndefined();
    expect(g?.testTarget).toBe("100%");
  });

  it("9월 1주차는 목표 대신 비고", () => {
    const g = pickSasiGoal("2026-09-04");
    expect(g?.label).toBe("9월 1주차");
    expect(g?.note).toBe("최종 테스트 진행");
    expect(g?.dDay).toBe(3);
  });

  it("마지막 주차를 넘기면 섹션이 사라진다", () => {
    expect(pickSasiGoal("2026-09-05")).toBeUndefined();
  });

  it("시작 이전(7/26)도 없음", () => {
    expect(pickSasiGoal("2026-07-26")).toBeUndefined();
  });
});

describe("pickFeatureIntros — 호수별 핀", () => {
  it("핀 없는 호는 기존 순환을 그대로 쓴다", () => {
    expect(pickFeatureIntros(4)).toEqual(FEATURE_INTROS.slice(5, 8));
  });

  it("핀이 있어도 count를 명시하면 그 개수만", () => {
    expect(pickFeatureIntros(3, 1)).toHaveLength(1);
  });

  it("핀 항목은 카탈로그에 실제로 존재한다", () => {
    for (const f of pickFeatureIntros(3)) {
      expect(FEATURE_INTROS).toContain(f);
    }
  });
});
