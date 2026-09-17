import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import type { ListRow } from "../../../../patterns/ListPattern";
import type { AssignmentChange } from "@/features/assignments/ledger-schemas";
import { kstDateTime } from "@/lib/kst-format";
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

/**
 * 이력 섹션 — **"이 칸이 왜 이 사람인가" 에 답하는 자리**다.
 *
 * 표로 그리지 않는다. 인스펙터는 340px 이라 5칸짜리 표는 가로로 넘치고, 넘치면
 * 가로 스크롤 안에서 되돌리기 버튼이 사라진다.
 *
 * 되돌리기는 **최신 한 줄에만** 활성이다(`revertBlockedReason`). 서버도 같은 판정을
 * 다시 하지만, 눌러 보고 나서야 "안 된다" 를 듣는 버튼은 고장으로 보인다.
 */
const CHANGE_OPS = [
  { email: "a@x.com", name: "가운영" },
  { email: "b@x.com", name: "나운영" },
];

const ISO_OLD = "2026-09-15T01:00:00.000Z";
const ISO_NEW = "2026-09-16T01:00:00.000Z";

const chg = (o: Partial<AssignmentChange> = {}): AssignmentChange => ({
  id: "c-new",
  academic_year: 2027,
  university_name: "한양대학교",
  work_kind: "PIMS",
  subtype: "FULL",
  role: "운영",
  prev_assignee: "a@x.com",
  next_assignee: "b@x.com",
  source: "manual",
  actor_email: "admin@x.com",
  changed_at: ISO_NEW,
  ...o,
});

describe("AssignmentsView — 변경 이력", () => {
  it("이력 prop 이 없으면 섹션을 그리지 않는다", () => {
    render(<AssignmentsView row={makeLedgerRow()} />);
    expect(screen.queryByText("변경 이력")).toBeNull();
  });

  it("이력이 비면 없다고 한 줄 적는다", () => {
    render(<AssignmentsView row={makeLedgerRow()} assignmentChanges={[]} />);
    expect(screen.getByText("변경 이력")).toBeInTheDocument();
    expect(screen.getByText(/아직 없습니다/)).toBeInTheDocument();
  });

  it("표로 그리지 않는다 — 인스펙터 폭에서 가로로 넘친다", () => {
    render(
      <AssignmentsView row={makeLedgerRow()} assignmentChanges={[chg()]} />,
    );
    expect(screen.queryByRole("table")).toBeNull();
  });

  it("바뀐 방향을 사람 이름으로 보여준다", () => {
    render(
      <AssignmentsView
        row={makeLedgerRow()}
        assignmentChanges={[chg()]}
        assignmentOperators={CHANGE_OPS}
      />,
    );
    expect(screen.getByText(/가운영 → 나운영/)).toBeInTheDocument();
  });

  /**
   * 이력은 이메일 단위이고 이름 스냅샷이 없다(마이그레이션 주석). 명부에서 사라진
   * 주소는 이름을 찾을 수 없는데, 그게 곧 되돌리기가 막히는 이유다(F14) — 그 주소를
   * 보여줘야 사람이 무슨 일인지 안다.
   */
  it("명부에 없는 주소는 그대로 보여준다", () => {
    render(
      <AssignmentsView
        row={makeLedgerRow()}
        assignmentChanges={[chg({ prev_assignee: "사라진@x.com" })]}
        assignmentOperators={CHANGE_OPS}
      />,
    );
    expect(screen.getByText(/사라진@x.com → 나운영/)).toBeInTheDocument();
  });

  it("비어 있던 칸이 채워진 줄은 미배정에서 왔다고 보여준다", () => {
    render(
      <AssignmentsView
        row={makeLedgerRow()}
        assignmentChanges={[chg({ prev_assignee: null, source: "import" })]}
        assignmentOperators={CHANGE_OPS}
      />,
    );
    expect(screen.getByText(/미배정 → 나운영/)).toBeInTheDocument();
  });

  it("언제·어느 칸·무엇으로 바뀐 것인지 함께 적는다", () => {
    render(
      <AssignmentsView
        row={makeLedgerRow()}
        assignmentChanges={[chg()]}
        assignmentOperators={CHANGE_OPS}
      />,
    );
    expect(screen.getByText(kstDateTime(ISO_NEW))).toBeInTheDocument();
    expect(screen.getByText(/PIMS · FULL · 운영/)).toBeInTheDocument();
    expect(screen.getByText("수동")).toBeInTheDocument();
  });

  it("되돌리기는 그 칸의 최신 줄에만 활성이다", () => {
    render(
      <AssignmentsView
        row={makeLedgerRow()}
        assignmentChanges={[
          chg(),
          chg({
            id: "c-old",
            changed_at: ISO_OLD,
            prev_assignee: null,
            next_assignee: "a@x.com",
          }),
        ]}
        assignmentOperators={CHANGE_OPS}
        onRevertChange={vi.fn()}
      />,
    );
    const buttons = screen.getAllByRole("button", { name: "되돌리기" });
    expect(buttons).toHaveLength(1);
  });

  it("막힌 줄은 이유를 적는다 — 버튼만 사라지면 왜인지 모른다", () => {
    render(
      <AssignmentsView
        row={makeLedgerRow()}
        assignmentChanges={[
          chg(),
          chg({
            id: "c-old",
            changed_at: ISO_OLD,
            prev_assignee: null,
            next_assignee: "a@x.com",
          }),
        ]}
        assignmentOperators={CHANGE_OPS}
        onRevertChange={vi.fn()}
      />,
    );
    expect(screen.getByText(/또 바뀌었습니다/)).toBeInTheDocument();
  });

  it("되돌리기를 누르면 그 이력 id 로 부른다", async () => {
    const onRevertChange = vi.fn().mockResolvedValue({ ok: true });
    render(
      <AssignmentsView
        row={makeLedgerRow()}
        assignmentChanges={[chg()]}
        assignmentOperators={CHANGE_OPS}
        onRevertChange={onRevertChange}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "되돌리기" }));

    await waitFor(() =>
      expect(onRevertChange).toHaveBeenCalledWith("c-new"),
    );
  });

  it("되돌리기가 실패하면 사유를 보여준다", async () => {
    const onRevertChange = vi
      .fn()
      .mockResolvedValue({ ok: false, error: "연결 안 됨 — 주소가 없습니다" });
    render(
      <AssignmentsView
        row={makeLedgerRow()}
        assignmentChanges={[chg()]}
        assignmentOperators={CHANGE_OPS}
        onRevertChange={onRevertChange}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "되돌리기" }));

    expect(
      await screen.findByText(/연결 안 됨 — 주소가 없습니다/),
    ).toBeInTheDocument();
  });

  it("되돌릴 권한이 없으면 버튼을 안 그린다 — 이력은 전원 공개다", () => {
    render(
      <AssignmentsView
        row={makeLedgerRow()}
        assignmentChanges={[chg()]}
        assignmentOperators={CHANGE_OPS}
      />,
    );
    expect(screen.queryByRole("button", { name: "되돌리기" })).toBeNull();
    // 이력 자체는 보인다.
    expect(screen.getByText(/가운영 → 나운영/)).toBeInTheDocument();
  });
});
