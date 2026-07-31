import { describe, it, expect } from "vitest";
// vitest는 .mjs 상대 import를 타입 에러 없이 지원한다 (dev-control-lib 관례)
import {
  buildStoryPrompt,
  parseStoryJson,
  fallbackStory,
} from "../../../../../scripts/team-briefing/story-lib.mjs";

const payload = {
  dateLabel: "2026-07-17 (금)",
  contracts: {
    bySheet: [{ sheet: "4년제", done: 3, ongoing: 1 }],
    totalDone: 3,
    totalOngoing: 1,
  },
  weekRange: { startYmd: "2026-07-20", endYmd: "2026-07-24" },
  schedule: [
    {
      type: "shift",
      label: "근무",
      items: [
        {
          type: "shift",
          title: "야간 당직",
          start_at: "2026-07-21T00:00:00+09:00",
          end_at: null,
          all_day: true,
        },
      ],
    },
  ],
  closing: [
    {
      university_name: "건국대",
      service_name: "수시",
      pay_end_at: "2026-07-20T00:00:00+09:00",
      operator_name: "송영신",
    },
  ],
  aiWork: {
    count: 2,
    savedHours: 3,
    items: [
      {
        title: "계약서 검토 자동화",
        ai_tool: "claude",
        author_name: "김유민",
        saved_hours: 3,
      },
    ],
    more: 1,
  },
  tips: {
    newCount: 1,
    totalCount: 30,
    items: [{ title: "요약 팁", ai_tool: "claude", author_name: "김유민" }],
    more: 0,
  },
  insights: {
    newCount: 1,
    items: [
      {
        title: "Claude Code 실전",
        channel_title: "바이브랩스",
        view_count: 123456,
        url: "https://youtube.com/watch?v=abc",
      },
    ],
  },
  milestones: [
    { name: "박시현", years: 10, dateYmd: "2026-07-22", isPast: false },
  ],
  birthdays: [{ name: "김유민", dateYmd: "2026-07-21" }],
};

describe("buildStoryPrompt", () => {
  it("JSON 스키마 지시 + 주간 데이터(계약·마감·기념일) 포함", () => {
    const p = buildStoryPrompt(payload, 12);
    expect(p).toContain('"headline"');
    expect(p).toContain('"sections"');
    expect(p).toContain("제12호");
    expect(p).toContain("완료 3");
    expect(p).toContain("건국대");
    expect(p).toContain("박시현 10주년");
    expect(p).toContain("야간 당직");
    expect(p).toContain("계약서 검토 자동화");
    // 운영부 업무 컨텍스트 + 제호 + 생일
    expect(p).toContain("원서접수");
    expect(p).toContain("PIMS");
    expect(p).toContain("운영부 마법사");
    expect(p).toContain("김유민(07-21)");
  });

  it("빈 섹션은 '없음'으로 표기", () => {
    const p = buildStoryPrompt(
      { ...payload, schedule: [], closing: [], milestones: [], birthdays: [] },
      1,
    );
    expect(p).toContain("차주 일정");
    expect(p).toMatch(/차주 일정[^\n]*없음/);
    expect(p).toMatch(/마감 임박[^\n]*없음/);
    expect(p).toMatch(/근속 기념일[^\n]*없음/);
    expect(p).toMatch(/생일[^\n]*없음/);
  });
});

describe("parseStoryJson", () => {
  const valid = {
    headline: "계약 340건 돌파!",
    intro: "안녕하세요.",
    sections: { contracts: "a", schedule: "b", closing: "c", ai: "d" },
  };

  it("순수 JSON 파싱", () => {
    expect(parseStoryJson(JSON.stringify(valid))).toEqual(valid);
  });

  it("코드펜스로 감싼 JSON도 파싱", () => {
    expect(
      parseStoryJson("```json\n" + JSON.stringify(valid) + "\n```"),
    ).toEqual(valid);
  });

  it("필드 누락/비문자열 → null", () => {
    expect(parseStoryJson(JSON.stringify({ headline: "x" }))).toBeNull();
    expect(
      parseStoryJson(JSON.stringify({ ...valid, sections: { contracts: 1 } })),
    ).toBeNull();
  });

  it("JSON 아님 → null", () => {
    expect(parseStoryJson("이건 그냥 텍스트")).toBeNull();
  });
});

describe("fallbackStory", () => {
  it("수치 요약 문장 — headline에 완료 건수, 4개 섹션 전부 비어있지 않음", () => {
    const s = fallbackStory(payload);
    expect(s.headline).toContain("3");
    expect(s.intro.length).toBeGreaterThan(0);
    for (const k of ["contracts", "schedule", "closing", "ai"]) {
      expect((s.sections as Record<string, string>)[k].length).toBeGreaterThan(
        0,
      );
    }
  });
});

describe("기념일·기능 소개 코멘트", () => {
  it("프롬프트에 기능 소개 목록과 두 섹션 키가 포함된다", () => {
    const p = buildStoryPrompt(
      {
        ...payload,
        featureIntros: [
          {
            menu: "서비스 > 인수인계",
            title: "서비스별 인수인계 + 메일/PDF",
            desc: "14개 카테고리로 작성",
          },
        ],
      },
      3,
    );
    expect(p).toContain("celebration");
    expect(p).toContain("features");
    expect(p).toContain("서비스별 인수인계 + 메일/PDF");
  });

  it("celebration/features가 있으면 파싱 결과에 담긴다", () => {
    const r = parseStoryJson(
      JSON.stringify({
        headline: "h",
        intro: "i",
        sections: {
          contracts: "c",
          schedule: "s",
          closing: "cl",
          ai: "a",
          celebration: "축하 코멘트",
          features: "기능 코멘트",
        },
      }),
    );
    expect(r).not.toBeNull();
    expect(r!.sections.celebration).toBe("축하 코멘트");
    expect(r!.sections.features).toBe("기능 코멘트");
  });

  it("celebration/features가 없어도 파싱 성공 (구 발행분 호환)", () => {
    const r = parseStoryJson(
      JSON.stringify({
        headline: "h",
        intro: "i",
        sections: { contracts: "c", schedule: "s", closing: "cl", ai: "a" },
      }),
    );
    expect(r).not.toBeNull();
    expect(r!.sections.celebration).toBeUndefined();
  });
});

describe("앨범 코멘트 (album)", () => {
  it("프롬프트에 사진 캡션 목록과 album 키가 포함된다", () => {
    const p = buildStoryPrompt(
      {
        ...payload,
        images: {
          cover: { src: "https://cdn/c.jpg", caption: "군산성산애독채팬션-조경" },
          gallery: [
            { src: "https://cdn/g1.jpg", caption: "철길마을-달고나 체험" },
            { src: "https://cdn/g2.jpg", caption: "초원사진관-8월의 크리스마스" },
          ],
          videos: [{ src: "https://cdn/v.mp4", caption: "단합대회 영상" }],
        },
      },
      3,
    );
    expect(p).toContain("album");
    expect(p).toContain("철길마을-달고나 체험");
    expect(p).toContain("초원사진관-8월의 크리스마스");
    expect(p).toContain("단합대회 영상");
  });

  it("사진이 없으면 '없음'으로 표기", () => {
    const p = buildStoryPrompt(payload, 3);
    expect(p).toContain("사진·영상: 없음");
  });

  it("album이 있으면 파싱 결과에 담기고, 없어도 파싱 성공", () => {
    const withAlbum = parseStoryJson(
      JSON.stringify({
        headline: "h",
        intro: "i",
        sections: {
          contracts: "c",
          schedule: "s",
          closing: "cl",
          ai: "a",
          album: "군산으로 다녀왔어요.",
        },
      }),
    );
    expect(withAlbum!.sections.album).toBe("군산으로 다녀왔어요.");

    const without = parseStoryJson(
      JSON.stringify({
        headline: "h",
        intro: "i",
        sections: { contracts: "c", schedule: "s", closing: "cl", ai: "a" },
      }),
    );
    expect(without).not.toBeNull();
    expect(without!.sections.album).toBeUndefined();
  });
});
