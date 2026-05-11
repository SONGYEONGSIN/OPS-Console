import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ListPattern } from "../ListPattern";
import type { ListRow } from "../ListPattern";

const sampleRows: ListRow[] = [
  { id: "L-001", name: "민원 접수 #1", status: "urgent", owner: "박지연" },
  { id: "L-002", name: "민원 접수 #2", status: "active", owner: "김민수" },
  { id: "L-003", name: "민원 접수 #3", status: "approved", owner: "이수진" },
];

describe("ListPattern", () => {
  it("title heading 노출", () => {
    render(<ListPattern title="민원 목록" data={{ rows: sampleRows }} />);
    expect(
      screen.getByRole("heading", { name: "민원 목록", level: 2 }),
    ).toBeInTheDocument();
  });

  it("rows 모두 렌더 + 상태 라벨 한국어", () => {
    render(<ListPattern title="민원 목록" data={{ rows: sampleRows }} />);
    expect(screen.getByText("민원 접수 #1")).toBeInTheDocument();
    expect(screen.getByText("민원 접수 #2")).toBeInTheDocument();
    expect(screen.getByText("민원 접수 #3")).toBeInTheDocument();
    expect(screen.getByText("긴급")).toBeInTheDocument();
    expect(screen.getByText("활성")).toBeInTheDocument();
    expect(screen.getByText("정상")).toBeInTheDocument();
  });

  it("빈 데이터 — 데이터 없음 안내", () => {
    render(<ListPattern title="민원 목록" data={{ rows: [] }} />);
    expect(screen.getByText("데이터 없음")).toBeInTheDocument();
  });

  it("초기 상태 — Inspector 닫혀있음 (aria-hidden)", () => {
    render(<ListPattern title="민원 목록" data={{ rows: sampleRows }} />);
    const panel = screen.getByRole("complementary", { hidden: true });
    expect(panel).toHaveAttribute("aria-hidden", "true");
  });

  it("행 클릭 → Inspector 열림 + 선택 행 정보 노출", () => {
    render(<ListPattern title="민원 목록" data={{ rows: sampleRows }} />);
    fireEvent.click(screen.getByText("민원 접수 #1"));
    const panel = screen.getByRole("complementary");
    expect(panel).toHaveAttribute("aria-hidden", "false");
    // 패널 헤더에 행 이름 노출 (h3)
    expect(
      screen.getByRole("heading", { name: "민원 접수 #1", level: 3 }),
    ).toBeInTheDocument();
  });

  it("행 클릭 → 편집 버튼 노출", () => {
    render(<ListPattern title="민원 목록" data={{ rows: sampleRows }} />);
    fireEvent.click(screen.getByText("민원 접수 #1"));
    expect(screen.getByRole("button", { name: /편집/ })).toBeInTheDocument();
  });

  it("편집 → 이름 수정 → 저장 시 rows 갱신 + 패널 닫힘", () => {
    render(<ListPattern title="민원 목록" data={{ rows: sampleRows }} />);
    fireEvent.click(screen.getByText("민원 접수 #1"));
    fireEvent.click(screen.getByRole("button", { name: /편집/ }));
    const nameInput = screen.getByLabelText("이름");
    fireEvent.change(nameInput, { target: { value: "민원 갱신됨" } });
    fireEvent.click(screen.getByRole("button", { name: "저장" }));

    // 패널 닫힘 (aria-hidden=true)
    const panel = screen.getByRole("complementary", { hidden: true });
    expect(panel).toHaveAttribute("aria-hidden", "true");
    // rows 갱신 — 테이블에 새 이름 노출
    expect(screen.getByText("민원 갱신됨")).toBeInTheDocument();
    expect(screen.queryByText("민원 접수 #1")).not.toBeInTheDocument();
  });

  it("선택된 행 — 시각적으로 강조 (bg-washi-raised)", () => {
    render(<ListPattern title="민원 목록" data={{ rows: sampleRows }} />);
    const row = screen.getByText("민원 접수 #2").closest("tr");
    fireEvent.click(row!);
    expect(row?.className).toContain("bg-washi-raised");
  });
});

describe("ListPattern team variant + permission", () => {
  const teamRows: ListRow[] = [
    {
      id: "ys1114@jinhakapply.com",
      name: "송영신",
      status: "active",
      owner: "운영2팀",
      meta: "팀장",
      permission: "admin",
    },
    {
      id: "annooy@jinhakapply.com",
      name: "정윤나",
      status: "active",
      owner: "운영1팀",
      meta: "매니저",
      permission: "member",
    },
  ];

  it("team variant — 권한 컬럼에 '관리자' / '구성원' 라벨 노출", () => {
    render(
      <ListPattern title="조직" data={{ rows: teamRows }} variant="team" />,
    );
    expect(screen.getByText("관리자")).toBeInTheDocument();
    expect(screen.getByText("구성원")).toBeInTheDocument();
  });

  it("readOnly=true — '+ 신규 계정' 버튼 hide", () => {
    render(
      <ListPattern
        title="조직"
        data={{ rows: teamRows }}
        variant="team"
        readOnly
      />,
    );
    expect(
      screen.queryByRole("button", { name: /\+ 신규 계정/ }),
    ).not.toBeInTheDocument();
  });

  it("readOnly=false — '+ 신규 계정' 버튼 보임", () => {
    render(
      <ListPattern
        title="조직"
        data={{ rows: teamRows }}
        variant="team"
      />,
    );
    expect(
      screen.getByRole("button", { name: /\+ 신규 계정/ }),
    ).toBeInTheDocument();
  });

  it("readOnly=true + row click — '구성 편집' 버튼 hide", () => {
    render(
      <ListPattern
        title="조직"
        data={{ rows: teamRows }}
        variant="team"
        readOnly
      />,
    );
    fireEvent.click(screen.getByText("송영신"));
    expect(
      screen.queryByRole("button", { name: /편집/ }),
    ).not.toBeInTheDocument();
  });
});

describe("ListPattern 부수 UI (Epic 4 복원)", () => {
  const fixture = {
    rows: [
      { id: "r1", name: "Row 1", status: "urgent" as const, owner: "A" },
      { id: "r2", name: "Row 2", status: "active" as const, owner: "B" },
      { id: "r3", name: "Row 3", status: "active" as const, owner: "C" },
      { id: "r4", name: "Row 4", status: "approved" as const, owner: "D" },
    ],
  };

  it("초기 카운트 — 전체 rows 표시 (title · {N}건)", () => {
    render(<ListPattern title="서비스" data={fixture} />);
    expect(screen.getByText(/서비스/)).toBeInTheDocument();
    expect(screen.getByText(/4건/)).toBeInTheDocument();
  });

  it("필터 5개 버튼 노출 (전체/긴급/활성/점검중/정상)", () => {
    render(<ListPattern title="서비스" data={fixture} />);
    expect(screen.getByRole("button", { name: "전체" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "긴급" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "활성" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "점검중" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "정상" })).toBeInTheDocument();
  });

  it("필터 클릭 — 해당 status rows만 표시 + 카운트 갱신", () => {
    render(<ListPattern title="서비스" data={fixture} />);
    fireEvent.click(screen.getByRole("button", { name: "활성" }));
    expect(screen.getByText("Row 2")).toBeInTheDocument();
    expect(screen.getByText("Row 3")).toBeInTheDocument();
    expect(screen.queryByText("Row 1")).toBeNull();
    expect(screen.queryByText("Row 4")).toBeNull();
    expect(screen.getByText(/2건/)).toBeInTheDocument();
  });

  it("'전체' 클릭 시 모든 rows 복귀", () => {
    render(<ListPattern title="서비스" data={fixture} />);
    fireEvent.click(screen.getByRole("button", { name: "긴급" }));
    expect(screen.getByText(/1건/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "전체" }));
    expect(screen.getByText(/4건/)).toBeInTheDocument();
  });

  it("Demo 안내문 노출", () => {
    render(<ListPattern title="서비스" data={fixture} />);
    expect(screen.getByText(/Demo.*실제 데이터 미연결/)).toBeInTheDocument();
  });
});

describe("ListPattern post-notice variant — 담당 컬럼 제거", () => {
  const postRow: ListRow = {
    id: "n1",
    slug: "NT-001",
    name: "공지 1",
    status: "active",
    author: "송영신",
    owner: "송영신 · 팀장",
    meta: "2026.05.10",
  };

  it("post-notice — '담당' 헤더 미노출", () => {
    render(
      <ListPattern
        title="공지사항"
        data={{ rows: [postRow] }}
        variant="post-notice"
      />,
    );
    expect(
      screen.queryByRole("columnheader", { name: "담당" }),
    ).not.toBeInTheDocument();
  });

  it("post-feedback — '담당' 헤더 유지 (회귀 방지)", () => {
    render(
      <ListPattern
        title="피드백"
        data={{ rows: [postRow] }}
        variant="post-feedback"
      />,
    );
    expect(
      screen.getByRole("columnheader", { name: "담당" }),
    ).toBeInTheDocument();
  });
});

describe("ListPattern schedule variant", () => {
  const scheduleRows: ListRow[] = [
    {
      id: "evt-1",
      name: "주간 운영 회의",
      status: "active",
      owner: "팀 공통",
      scheduleType: "event",
      start_at: "2026-05-15T01:00:00Z",
      end_at: "2026-05-15T02:00:00Z",
      meta: "2026.05.15",
    },
    {
      id: "evt-2",
      name: "김지나 휴가",
      status: "active",
      owner: "김지나",
      scheduleType: "leave",
      start_at: "2026-05-20T00:00:00Z",
      end_at: "2026-05-20T23:59:59Z",
    },
  ];

  it("schedule variant — 시각/타입/제목/담당 헤더 노출", () => {
    render(
      <ListPattern
        title="일정"
        data={{ rows: scheduleRows }}
        variant="schedule"
      />,
    );
    expect(
      screen.getByRole("columnheader", { name: "시각" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("columnheader", { name: "타입" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("columnheader", { name: "제목" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("columnheader", { name: "담당" }),
    ).toBeInTheDocument();
  });

  it("schedule variant — 모든 행 노출 (전체 필터)", () => {
    render(
      <ListPattern
        title="일정"
        data={{ rows: scheduleRows }}
        variant="schedule"
      />,
    );
    expect(screen.getByText("주간 운영 회의")).toBeInTheDocument();
    expect(screen.getByText("김지나 휴가")).toBeInTheDocument();
  });

  it("schedule variant — type 필터 'leave' 클릭 시 휴가만 노출", () => {
    render(
      <ListPattern
        title="일정"
        data={{ rows: scheduleRows }}
        variant="schedule"
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "휴가" }));
    expect(screen.queryByText("주간 운영 회의")).not.toBeInTheDocument();
    expect(screen.getByText("김지나 휴가")).toBeInTheDocument();
  });
});

describe("ListPattern cohort variant — invite 상태 뱃지", () => {
  const baseCohort = (overrides: Partial<ListRow>): ListRow => ({
    id: "c1",
    name: "회차 1",
    status: "active",
    owner: "송영신",
    author: "김지나",
    cohortStatus: "in_progress",
    startDate: "2026-05-14",
    endDate: "2026-05-25",
    traineeEmail: "kjn@jinhakapply.com",
    invitedAt: null,
    acceptedAt: null,
    ...overrides,
  });

  it("invited_at 없음 → '미초대' 뱃지", () => {
    render(
      <ListPattern
        title="회차"
        data={{ rows: [baseCohort({ invitedAt: null, acceptedAt: null })] }}
        variant="cohort"
      />,
    );
    expect(screen.getByText("미초대")).toBeInTheDocument();
  });

  it("invited_at 있고 accepted_at 없음 → '수락 대기' 뱃지", () => {
    render(
      <ListPattern
        title="회차"
        data={{
          rows: [
            baseCohort({
              invitedAt: "2026-05-10T00:00:00Z",
              acceptedAt: null,
            }),
          ],
        }}
        variant="cohort"
      />,
    );
    expect(screen.getByText("수락 대기")).toBeInTheDocument();
  });

  it("accepted_at 있음 → '수락됨' 뱃지 (또는 미표시)", () => {
    render(
      <ListPattern
        title="회차"
        data={{
          rows: [
            baseCohort({
              invitedAt: "2026-05-10T00:00:00Z",
              acceptedAt: "2026-05-12T00:00:00Z",
            }),
          ],
        }}
        variant="cohort"
      />,
    );
    expect(screen.queryByText("미초대")).not.toBeInTheDocument();
    expect(screen.queryByText("수락 대기")).not.toBeInTheDocument();
    expect(screen.getByText("수락됨")).toBeInTheDocument();
  });
});

describe("ListPattern my-todo variant", () => {
  const todoRows: ListRow[] = [
    {
      id: "t-1",
      name: "Q3 시프트 스케줄 초안",
      status: "active",
      owner: "",
      priority: "high",
      done: false,
      dueAt: "2026-05-13T05:00:00Z",
    },
    {
      id: "t-2",
      name: "OJT 일정 작성",
      status: "active",
      owner: "",
      priority: "medium",
      done: true,
      dueAt: null,
    },
  ];

  it("my-todo variant — 우선순위/제목/마감/완료 헤더 노출", () => {
    render(
      <ListPattern
        title="오늘 할 일"
        data={{ rows: todoRows }}
        variant="my-todo"
      />,
    );
    expect(
      screen.getByRole("columnheader", { name: "우선순위" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("columnheader", { name: "제목" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("columnheader", { name: "마감" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("columnheader", { name: "완료" }),
    ).toBeInTheDocument();
  });

  it("my-todo variant — done=true row는 line-through 적용", () => {
    render(
      <ListPattern
        title="오늘 할 일"
        data={{ rows: todoRows }}
        variant="my-todo"
      />,
    );
    const doneRow = screen.getByText("OJT 일정 작성").closest("tr");
    expect(doneRow?.className).toMatch(/line-through/);
  });

  it("my-todo variant — '미완료' 필터 시 done=false만 노출", () => {
    render(
      <ListPattern
        title="오늘 할 일"
        data={{ rows: todoRows }}
        variant="my-todo"
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "미완료" }));
    expect(screen.getByText("Q3 시프트 스케줄 초안")).toBeInTheDocument();
    expect(screen.queryByText("OJT 일정 작성")).not.toBeInTheDocument();
  });

  it("my-todo variant — 체크박스 클릭은 인스펙터 안 열림 (stopPropagation)", () => {
    render(
      <ListPattern
        title="오늘 할 일"
        data={{ rows: todoRows }}
        variant="my-todo"
      />,
    );
    const checkbox = screen.getAllByRole("checkbox")[0];
    fireEvent.click(checkbox);
    // 인스펙터가 닫힌 상태 유지
    const panel = screen.getByRole("complementary", { hidden: true });
    expect(panel).toHaveAttribute("aria-hidden", "true");
  });
});

describe("ListPattern ai-work variant", () => {
  const aiWorkRows: ListRow[] = [
    {
      id: "aw-001",
      name: "회의록 요약 자동화",
      status: "active",
      owner: "송영석",
      workDate: "2026-05-10",
      aiTool: "chatgpt",
      category: "meeting",
    },
    {
      id: "aw-002",
      name: "운영 매뉴얼 번역",
      status: "active",
      owner: "송영석",
      workDate: "2026-05-09",
      aiTool: "claude",
      category: "translation",
    },
  ];

  it("5 컬럼 헤더 렌더 (작업일/제목/AI 도구/카테고리/등록자)", () => {
    render(
      <ListPattern
        title="내 작업"
        data={{ rows: aiWorkRows }}
        variant="ai-work"
      />,
    );
    expect(screen.getByText("작업일")).toBeInTheDocument();
    expect(screen.getByText("제목")).toBeInTheDocument();
    expect(screen.getByText("AI 도구")).toBeInTheDocument();
    expect(screen.getByText("카테고리")).toBeInTheDocument();
    expect(screen.getByText("등록자")).toBeInTheDocument();
    // 기본 4컬럼 ID는 미노출
    expect(screen.queryByText("ID")).not.toBeInTheDocument();
  });

  it("AI 도구 / 카테고리 라벨 한국어 + chip 렌더", () => {
    render(
      <ListPattern
        title="내 작업"
        data={{ rows: aiWorkRows }}
        variant="ai-work"
      />,
    );
    expect(screen.getByText("ChatGPT")).toBeInTheDocument();
    expect(screen.getByText("Claude")).toBeInTheDocument();
    expect(screen.getByText("회의")).toBeInTheDocument();
    expect(screen.getByText("번역")).toBeInTheDocument();
  });

  it("작업일·제목·등록자 셀 노출", () => {
    render(
      <ListPattern
        title="내 작업"
        data={{ rows: aiWorkRows }}
        variant="ai-work"
      />,
    );
    expect(screen.getByText("2026-05-10")).toBeInTheDocument();
    expect(screen.getByText("회의록 요약 자동화")).toBeInTheDocument();
    expect(screen.getAllByText("송영석").length).toBeGreaterThan(0);
  });

  it("행 클릭 시 인스펙터 열림", () => {
    render(
      <ListPattern
        title="내 작업"
        data={{ rows: aiWorkRows }}
        variant="ai-work"
      />,
    );
    fireEvent.click(screen.getByText("회의록 요약 자동화"));
    const panel = screen.getByRole("complementary", { hidden: true });
    expect(panel).toHaveAttribute("aria-hidden", "false");
  });

  it("'+ AI 활용 등록' 버튼 클릭 시 빈 row의 owner가 currentUserName으로 자동 채워짐", () => {
    render(
      <ListPattern
        title="내 작업"
        data={{ rows: [] }}
        variant="ai-work"
        canCreate
        currentUserName="송영석"
        createLabel="+ AI 활용 등록"
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "+ AI 활용 등록" }));
    // 폼에 본인 자동 입력 안내 + 이름 노출
    expect(screen.getByText(/본인 자동 입력/)).toBeInTheDocument();
    expect(screen.getAllByText(/송영석/).length).toBeGreaterThan(0);
  });

  it("currentUserName 미전달 시에도 신규 버튼은 동작 (owner 빈값)", () => {
    render(
      <ListPattern
        title="내 작업"
        data={{ rows: [] }}
        variant="ai-work"
        canCreate
        createLabel="+ AI 활용 등록"
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "+ AI 활용 등록" }));
    const panel = screen.getByRole("complementary", { hidden: true });
    expect(panel).toHaveAttribute("aria-hidden", "false");
  });
});
