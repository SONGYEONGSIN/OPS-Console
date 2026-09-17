import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import type { ListRow } from "../../../../patterns/ListPattern";
import { AssignmentsView } from "../View";

const makeRow = (overrides: Partial<ListRow> = {}): ListRow => ({
  id: "bbbbbbbb-2222-4222-8222-bbbbbbbbbbbb",
  name: "한양대학교",
  status: "active",
  owner: "",
  assignment: {
    academicYear: 2027,
    byService: {
      원서접수: {
        operator: "홍길동",
        developer: "이순신",
        detail: [
          { label: "2027 수시 운영", value: "담당" },
          { label: "2027 정시 운영", value: "보조" },
        ],
      },
      PIMS: {
        operator: "강감찬",
        developer: "",
        detail: [],
      },
    },
  },
  ...overrides,
});

/**
 * 원장을 읽는 행 — `cells` 가 자연키 단위로 들어온다(PR4a).
 *
 * 원서접수 수시는 **운영·개발이 한 칸씩 짝**이고, 정시는 운영만 있는데 그 운영이
 * 명부에 안 붙었다(`email: null`). 세 칸이 한 서비스 안에서 각자 다른 상태다.
 */
const makeLedgerRow = (overrides: Partial<ListRow> = {}): ListRow => ({
  id: "한양대학교",
  name: "한양대학교",
  status: "active",
  owner: "",
  assignment: {
    academicYear: 2027,
    byService: {
      원서접수: {
        operator: "",
        developer: "",
        detail: [],
        cells: [
          {
            subtype: "수시",
            role: "운영",
            name: "홍길동",
            email: "hong@ex.com",
          },
          { subtype: "수시", role: "개발", name: "이순신", email: null },
          { subtype: "정시", role: "운영", name: "김유신", email: null },
        ],
      },
    },
  },
  ...overrides,
});

describe("AssignmentsView — 원장 칸", () => {
  it("학년도를 보여준다 — 편집·이력이 학년도 안에서만 뜻이 있다", () => {
    render(<AssignmentsView row={makeLedgerRow()} />);
    expect(screen.getByText("2027학년도")).toBeInTheDocument();
  });

  it("칸을 하위유형·역할로 나눠 보여준다 — 접어서 대표 하나만 보이면 안 된다", () => {
    render(<AssignmentsView row={makeLedgerRow()} />);
    for (const t of ["수시", "정시", "홍길동", "이순신", "김유신"]) {
      expect(screen.getByText(t)).toBeInTheDocument();
    }
  });

  /** 배지는 대학 단위라 '어느 칸이냐'를 말해주지 못한다. 고칠 자리를 여기서 짚는다. */
  it("메일이 안 붙은 운영 칸에 '연결 안 됨' 을 붙인다", () => {
    render(<AssignmentsView row={makeLedgerRow()} />);
    const marks = screen.getAllByText("연결 안 됨");
    expect(marks).toHaveLength(1);
    expect(marks[0].closest("li")).toHaveTextContent("김유신");
  });

  it("붙은 운영 칸은 어느 메일에 붙었는지 보여준다 — 동명이인이면 이름만으론 못 가린다", () => {
    render(<AssignmentsView row={makeLedgerRow()} />);
    expect(screen.getByText("hong@ex.com")).toBeInTheDocument();
  });

  /**
   * 개발 칸은 **언제나** 메일이 없다 — `operators` 가 운영부 표라
   * (`check (team in ('운영1팀','운영2팀'))`) 개발자는 구조적으로 못 들어간다.
   * 고칠 길이 없는 것을 경고로 띄우면 잡음이고, 잡음은 진짜 신호를 덮는다(#1195).
   */
  it("개발 칸은 메일이 없어도 '연결 안 됨' 이 아니다", () => {
    render(<AssignmentsView row={makeLedgerRow()} />);
    expect(screen.getByText("연결 안 됨").closest("li")).not.toHaveTextContent(
      "이순신",
    );
  });

  it("개발 칸이 있으면 이름만 두는 이유를 적는다", () => {
    render(<AssignmentsView row={makeLedgerRow()} />);
    expect(screen.getByText(/개발 칸은 이름만/)).toBeInTheDocument();
  });

  it("개발 칸이 없으면 그 안내를 안 적는다 — 늘 뜨는 문구는 안 읽힌다", () => {
    render(
      <AssignmentsView
        row={makeLedgerRow({
          assignment: {
            academicYear: 2027,
            byService: {
              PIMS: {
                operator: "",
                developer: "",
                detail: [],
                cells: [
                  {
                    subtype: "FULL",
                    role: "운영",
                    name: "강감찬",
                    email: "kang@ex.com",
                  },
                ],
              },
            },
          },
        })}
      />,
    );
    expect(screen.queryByText(/개발 칸은 이름만/)).toBeNull();
  });
});

describe("AssignmentsView", () => {
  it("대학명(h2) 렌더", () => {
    render(<AssignmentsView row={makeRow()} />);
    const heading = screen.getByRole("heading", { level: 2 });
    expect(heading).toHaveTextContent("한양대학교");
  });

  it("서비스 섹션 — 운영자 노출", () => {
    render(<AssignmentsView row={makeRow()} />);
    // 원서접수 섹션의 "운영 홍길동" 표시
    expect(screen.getByText(/운영 홍길동/)).toBeInTheDocument();
  });

  it("개발자 있을 때 — '· 개발 {dev}' 포함", () => {
    render(<AssignmentsView row={makeRow()} />);
    expect(screen.getByText(/· 개발 이순신/)).toBeInTheDocument();
  });

  it("개발자 없을 때(PIMS) — '· 개발 ...' 미노출", () => {
    render(<AssignmentsView row={makeRow()} />);
    expect(screen.queryByText(/개발 강감찬/)).toBeNull();
  });

  it("detail 항목 있을 때 — label과 value 렌더", () => {
    render(<AssignmentsView row={makeRow()} />);
    expect(screen.getByText("2027 수시 운영")).toBeInTheDocument();
    expect(screen.getByText("담당")).toBeInTheDocument();
    expect(screen.getByText("2027 정시 운영")).toBeInTheDocument();
    expect(screen.getByText("보조")).toBeInTheDocument();
  });

  it("byService에 없는 서비스 섹션 — 렌더하지 않음", () => {
    render(<AssignmentsView row={makeRow()} />);
    // 대학원, 성적산출, 상담앱은 byService에 없으므로 h3가 2개만 존재
    const serviceHeadings = screen.getAllByRole("heading", { level: 3 });
    const serviceNames = serviceHeadings.map((h) => h.textContent);
    expect(serviceNames).toContain("원서접수");
    expect(serviceNames).toContain("PIMS");
    expect(serviceNames).not.toContain("대학원");
    expect(serviceNames).not.toContain("성적산출");
    expect(serviceNames).not.toContain("상담앱");
  });
});
