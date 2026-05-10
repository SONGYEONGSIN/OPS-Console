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
