import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { BriefingNewsletter } from "../BriefingNewsletter";
import type { BriefingPayload } from "@/features/automations/jobs/team-briefing-build";

const payload: BriefingPayload = {
  dateLabel: "2026-07-17 (금)",
  contracts: {
    bySheet: [
      { sheet: "4년제", done: 3, ongoing: 1 },
      { sheet: "전문대", done: 1, ongoing: 0 },
    ],
    totalDone: 4,
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
      {
        title: "주간보고 초안",
        ai_tool: "chatgpt",
        author_name: "lee",
        saved_hours: null,
      },
    ],
    more: 0,
  },
  tips: {
    newCount: 1,
    totalCount: 30,
    items: [{ title: "요약 자동화 팁", ai_tool: "claude", author_name: "김유민" }],
    more: 0,
  },
  insights: {
    newCount: 1,
    items: [
      {
        title: "Claude Code 실전",
        channel_title: "바이브랩스",
        view_count: 123456,
        url: "https://www.youtube.com/watch?v=abc123",
      },
    ],
  },
};

describe("BriefingNewsletter", () => {
  it("제호(주간 브리핑·호수·발행일) 렌더", () => {
    render(<BriefingNewsletter issueNo={12} payload={payload} />);
    expect(
      screen.getByRole("heading", { level: 1, name: /주간 브리핑/ }),
    ).toBeInTheDocument();
    expect(screen.getByText("#12")).toBeInTheDocument();
    expect(screen.getByText(/2026-07-17 \(금\)/)).toBeInTheDocument();
    expect(screen.getByText("운영부 상황실")).toBeInTheDocument();
  });

  it("계약현황 — 시트별 수치 + 합계·완료율", () => {
    render(<BriefingNewsletter issueNo={12} payload={payload} />);
    expect(screen.getByText(/계약 이야기/)).toBeInTheDocument();
    expect(screen.getByText("4년제")).toBeInTheDocument();
    // 합계 행: 총 5 · 완료 4 · 진행중 1 → 80.0% (시트별 75.0%/100.0%와 구분)
    expect(screen.getByText("80.0%")).toBeInTheDocument();
  });

  it("차주 팀 업무 — 주간 범위·유형 뱃지·일정 항목", () => {
    render(<BriefingNewsletter issueNo={12} payload={payload} />);
    expect(screen.getByText(/2026-07-20 ~ 2026-07-24/)).toBeInTheDocument();
    expect(screen.getByText("근무")).toBeInTheDocument();
    expect(screen.getByText(/야간 당직/)).toBeInTheDocument();
  });

  it("서비스 마감 임박 — 날짜·대학·담당자", () => {
    render(<BriefingNewsletter issueNo={12} payload={payload} />);
    expect(screen.getByText(/마감 이야기/)).toBeInTheDocument();
    expect(screen.getByText(/건국대/)).toBeInTheDocument();
    expect(screen.getByText(/송영신/)).toBeInTheDocument();
  });

  it("AI 활용 — 작업(이름·시간)·TIP·인사이트 링크", () => {
    render(<BriefingNewsletter issueNo={12} payload={payload} />);
    expect(screen.getByText(/계약서 검토 자동화/)).toBeInTheDocument();
    expect(screen.getByText(/김유민 · 3h/)).toBeInTheDocument();
    expect(screen.getByText(/요약 자동화 팁/)).toBeInTheDocument();
    const link = screen.getByRole("link", { name: /Claude Code 실전/ });
    expect(link).toHaveAttribute(
      "href",
      "https://www.youtube.com/watch?v=abc123",
    );
    expect(screen.getByText(/조회 12.3만/)).toBeInTheDocument();
  });

  it("스토리 — 캐치 headline이 h1, 인트로·섹션 문단 렌더", () => {
    render(
      <BriefingNewsletter
        issueNo={12}
        payload={{
          ...payload,
          story: {
            headline: "계약 340건 돌파! 이번 주 운영부가 해낸 일들",
            intro: "안녕하세요, 운영부 여러분의 한 주를 모았습니다.",
            sections: {
              contracts: "이번 주 4년제 시트에서 완료율이 크게 올랐어요.",
              schedule: "다음 주엔 야간 당직이 예정돼 있어요.",
              closing: "건국대 수시 마감이 코앞입니다.",
              ai: "클로드로 계약서 검토를 자동화했어요.",
            },
          },
        }}
      />,
    );
    expect(
      screen.getByRole("heading", {
        level: 1,
        name: /계약 340건 돌파! 이번 주 운영부가 해낸 일들/,
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/운영부 여러분의 한 주를 모았습니다/),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/4년제 시트에서 완료율이 크게 올랐어요/),
    ).toBeInTheDocument();
    expect(screen.getByText(/건국대 수시 마감이 코앞입니다/)).toBeInTheDocument();
  });

  it("근속 기념일 코너 — milestones 있을 때 축하 렌더, 없으면 미노출", () => {
    const { rerender } = render(
      <BriefingNewsletter
        issueNo={12}
        payload={{
          ...payload,
          milestones: [
            { name: "박시현", years: 10, dateYmd: "2026-07-22" },
          ],
        }}
      />,
    );
    expect(screen.getByText(/이번 주의 기념일/)).toBeInTheDocument();
    expect(screen.getByText("박시현")).toBeInTheDocument();
    expect(screen.getByText(/입사 10주년/)).toBeInTheDocument();

    rerender(<BriefingNewsletter issueNo={12} payload={payload} />);
    expect(screen.queryByText(/이번 주의 기념일/)).toBeNull();
  });

  it("빈 섹션 — 일정·마감·AI 모두 빈 문구", () => {
    render(
      <BriefingNewsletter
        issueNo={1}
        payload={{
          ...payload,
          schedule: [],
          closing: [],
          aiWork: { count: 0, savedHours: 0, items: [], more: 0 },
          tips: { newCount: 0, totalCount: 30, items: [], more: 0 },
          insights: { newCount: 0, items: [] },
        }}
      />,
    );
    expect(screen.getByText("예정된 일정 없음")).toBeInTheDocument();
    expect(screen.getByText("임박한 마감 없음")).toBeInTheDocument();
    expect(screen.getByText("등록된 AI 작업 없음")).toBeInTheDocument();
  });
});
