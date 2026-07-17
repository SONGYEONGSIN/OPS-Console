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
  milestones: [{ name: "박시현", years: 10, dateYmd: "2026-07-22" }],
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
      parseStoryJson(
        JSON.stringify({ ...valid, sections: { contracts: 1 } }),
      ),
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
