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
    totalCount: 9,
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
    items: [
      { title: "요약 자동화 팁", ai_tool: "claude", author_name: "김유민" },
    ],
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
  it("제호 — '운영부 마법사' + #012(3자리 패딩) + 발행일", () => {
    render(<BriefingNewsletter issueNo={12} payload={payload} />);
    expect(
      screen.getByRole("heading", { level: 1, name: /주간 뉴스레터/ }),
    ).toBeInTheDocument();
    expect(screen.getAllByText(/#012/).length).toBeGreaterThan(0);
    expect(screen.getByText(/2026-07-17 \(금\)/)).toBeInTheDocument();
    expect(screen.getByText("운영부 마법사")).toBeInTheDocument();
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
    expect(
      screen.getByText(/건국대 수시 마감이 코앞입니다/),
    ).toBeInTheDocument();
  });

  it("기념일 코너 — 근속 + 생일 함께 렌더, 없으면 미노출", () => {
    const { rerender } = render(
      <BriefingNewsletter
        issueNo={12}
        payload={{
          ...payload,
          milestones: [
            { name: "박시현", years: 10, dateYmd: "2026-07-22", isPast: false },
          ],
          birthdays: [{ name: "김유민", dateYmd: "2026-07-21" }],
        }}
      />,
    );
    expect(screen.getByText(/이번 주의 기념일/)).toBeInTheDocument();
    expect(screen.getByText("박시현")).toBeInTheDocument();
    expect(screen.getByText(/입사 10주년/)).toBeInTheDocument();
    expect(screen.getByText("김유민")).toBeInTheDocument();
    expect(screen.getByText("생일")).toBeInTheDocument();

    rerender(<BriefingNewsletter issueNo={12} payload={payload} />);
    expect(screen.queryByText(/이번 주의 기념일/)).toBeNull();
  });

  it("기념일·기능 소개 — claude 코멘트 문단이 카드 위에 렌더된다", () => {
    render(
      <BriefingNewsletter
        issueNo={12}
        payload={{
          ...payload,
          milestones: [
            { name: "박시현", years: 10, dateYmd: "2026-07-22", isPast: false },
          ],
          featureIntros: [
            {
              menu: "서비스 > 사고보고",
              title: "사고 등록부터 경위서 승인까지",
              desc: "승인대기·승인완료 상태가 목록에서 바로 보여요.",
            },
          ],
          story: {
            headline: "h",
            intro: "i",
            sections: {
              contracts: "c",
              schedule: "s",
              closing: "cl",
              ai: "a",
              celebration: "이번 주는 축하할 일이 많아요.",
              features: "사고보고는 이럴 때 씁니다.",
            },
          },
        }}
      />,
    );
    expect(screen.getByText("이번 주는 축하할 일이 많아요.")).toBeInTheDocument();
    expect(screen.getByText("사고보고는 이럴 때 씁니다.")).toBeInTheDocument();
    expect(screen.getByText("사고 등록부터 경위서 승인까지")).toBeInTheDocument();
  });

  it("기념일·기능 소개 — 코멘트가 없으면 문단 없이 목록만", () => {
    render(
      <BriefingNewsletter
        issueNo={12}
        payload={{
          ...payload,
          milestones: [
            { name: "박시현", years: 10, dateYmd: "2026-07-22", isPast: false },
          ],
        }}
      />,
    );
    expect(screen.getByText(/이번 주의 기념일/)).toBeInTheDocument();
    expect(screen.getByText(/입사 10주년/)).toBeInTheDocument();
  });

  it("앨범 — claude 코멘트 문단이 사진 그리드 위에 렌더된다", () => {
    render(
      <BriefingNewsletter
        issueNo={12}
        payload={{
          ...payload,
          images: {
            cover: { src: "https://cdn/x/cover.jpg", caption: "군산 숙소" },
            gallery: [{ src: "https://cdn/x/g1.jpg", caption: "철길마을" }],
            videos: [],
          },
          story: {
            headline: "h",
            intro: "i",
            sections: {
              contracts: "c",
              schedule: "s",
              closing: "cl",
              ai: "a",
              album: "이번 주말엔 군산으로 다녀왔어요.",
            },
          },
        }}
      />,
    );
    expect(
      screen.getByText("이번 주말엔 군산으로 다녀왔어요."),
    ).toBeInTheDocument();
    expect(screen.getByText("철길마을")).toBeInTheDocument();
  });

  it("사진·영상 — 커버 + 앨범 그리드(캡션) + 비디오 렌더", () => {
    const { container } = render(
      <BriefingNewsletter
        issueNo={12}
        payload={{
          ...payload,
          images: {
            cover: {
              src: "https://cdn/x/cover.jpg",
              caption: "운영1팀 단체사진",
            },
            gallery: [
              { src: "https://cdn/x/g1.jpg", caption: "발표하는 승철 부장님" },
              { src: "https://cdn/x/g2.jpg" },
            ],
            videos: [{ src: "https://cdn/x/v1.mp4", caption: "미션 영상" }],
          },
        }}
      />,
    );
    expect(screen.getByAltText("운영1팀 단체사진")).toHaveAttribute(
      "src",
      "https://cdn/x/cover.jpg",
    );
    expect(screen.getByText(/이번 주 앨범/)).toBeInTheDocument();
    expect(screen.getByText("발표하는 승철 부장님")).toBeInTheDocument();
    expect(screen.getByText(/이번 주 영상/)).toBeInTheDocument();
    const video = container.querySelector("video");
    expect(video).not.toBeNull();
    expect(video!.getAttribute("src")).toBe("https://cdn/x/v1.mp4");
  });

  it("빈 섹션 — 일정·마감·AI 모두 빈 문구", () => {
    render(
      <BriefingNewsletter
        issueNo={1}
        payload={{
          ...payload,
          schedule: [],
          closing: [],
          aiWork: {
            count: 0,
            totalCount: 0,
            savedHours: 0,
            items: [],
            more: 0,
          },
          tips: { newCount: 0, totalCount: 30, items: [], more: 0 },
          insights: { newCount: 0, items: [] },
        }}
      />,
    );
    expect(screen.getByText("예정된 일정 없음")).toBeInTheDocument();
    expect(screen.getByText("임박한 마감 없음")).toBeInTheDocument();
    expect(
      screen.getByText("아직 등록된 AI 작업이 없어요"),
    ).toBeInTheDocument();
  });
});

describe("대학가 소식 · 수시 준비 섹션", () => {
  it("newsPick이 있으면 제목·코멘트·링크를 렌더한다", () => {
    render(
      <BriefingNewsletter
        issueNo={3}
        payload={{
          ...payload,
          story: {
            headline: "h",
            intro: "i",
            sections: {
              contracts: "c",
              schedule: "s",
              closing: "cl",
              ai: "a",
            },
            newsPick: {
              title: "사립대학구조개선법 시행령 통과",
              url: "https://a.example/1",
              source: "usline",
              comment: "교육부가 직접 폐교 명령을 내릴 수 있게 됩니다.",
            },
          },
        }}
      />,
    );
    expect(screen.getByText("대학가 소식")).toBeInTheDocument();
    expect(screen.getByText(/교육부가 직접 폐교 명령/)).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "사립대학구조개선법 시행령 통과" }),
    ).toHaveAttribute("href", "https://a.example/1");
  });

  it("newsPick이 없으면 섹션 자체가 없다", () => {
    render(<BriefingNewsletter issueNo={3} payload={payload} />);
    expect(screen.queryByText("대학가 소식")).not.toBeInTheDocument();
  });

  it("sasiGoal이 있으면 주차·목표·D-day를 렌더한다", () => {
    render(
      <BriefingNewsletter
        issueNo={3}
        payload={{
          ...payload,
          sasiGoal: {
            label: "8월 1주차",
            rangeLabel: "8/3~8/9",
            devTarget: "50%",
            testTarget: "20%",
            dDay: 35,
            applyStartLabel: "9/7(월)",
          },
        }}
      />,
    );
    expect(screen.getByText("수시 준비")).toBeInTheDocument();
    expect(screen.getByText("8월 1주차 (8/3~8/9)")).toBeInTheDocument();
    expect(screen.getByText("50%")).toBeInTheDocument();
    expect(screen.getByText("D-35")).toBeInTheDocument();
  });

  it("sasiGoal이 없으면 섹션 자체가 없다", () => {
    render(<BriefingNewsletter issueNo={3} payload={payload} />);
    expect(screen.queryByText("수시 준비")).not.toBeInTheDocument();
  });
});

/**
 * 커버 자리에 영상을 넣는다.
 *
 * 사진이 없는 주에는 커버가 통째로 비었다. 링크로 걸면 뉴스레터를 떠나야 보므로
 * **프레임으로 넣어 그 자리에서 재생**되게 한다(2026-08-21 요청).
 */
describe("BriefingNewsletter — 영상 커버", () => {
  const withVideo: BriefingPayload = {
    ...payload,
    images: {
      video: {
        src: "https://www.youtube.com/shorts/GNSy-p-gp78",
        caption: "월요일 아침, 우리 모두의 표정",
      },
    },
  };

  it("프레임으로 넣는다 — 링크가 아니라", () => {
    render(<BriefingNewsletter issueNo={12} payload={withVideo} />);
    const frame = screen.getByTitle(/영상/);
    expect(frame.tagName).toBe("IFRAME");
    expect(frame).toHaveAttribute(
      "src",
      "https://www.youtube.com/embed/GNSy-p-gp78",
    );
  });

  it("썸네일 멘트를 프레임 위에 보여준다", () => {
    render(<BriefingNewsletter issueNo={12} payload={withVideo} />);
    expect(
      screen.getByText("월요일 아침, 우리 모두의 표정"),
    ).toBeInTheDocument();
  });

  it("유튜브가 아니면 프레임을 만들지 않는다 — 아무 주소나 띄우지 않는다", () => {
    render(
      <BriefingNewsletter
        issueNo={12}
        payload={{
          ...payload,
          images: { video: { src: "https://evil.example.com/embed/x" } },
        }}
      />,
    );
    expect(screen.queryByTitle(/영상/)).toBeNull();
  });

  it("사진 커버가 있으면 사진을 쓴다 — 둘 다 있을 때 자리를 다투지 않는다", () => {
    render(
      <BriefingNewsletter
        issueNo={12}
        payload={{
          ...payload,
          images: {
            cover: { src: "/a.jpg", caption: "사진" },
            video: { src: "https://www.youtube.com/shorts/GNSy-p-gp78" },
          },
        }}
      />,
    );
    expect(screen.getByAltText("사진")).toBeInTheDocument();
    expect(screen.queryByTitle(/영상/)).toBeNull();
  });
});
