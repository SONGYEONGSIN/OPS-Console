import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import type { ListRow } from "../../../../patterns/ListPattern";
import { AssignmentsTable } from "../Table";
import { ASSIGNMENT_BADGE_TONE } from "../status";

const makeRow = (overrides: Partial<ListRow> = {}): ListRow => ({
  id: "aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa",
  name: "가천대학교",
  status: "active",
  owner: "",
  assignment: {
    academicYear: 2027,
    byService: {
      원서접수: { operator: "홍길동", developer: "이순신", detail: [] },
      PIMS: { operator: "강감찬", developer: "", detail: [] },
    },
  },
  ...overrides,
});

/**
 * **행 클릭을 되살린다**(PR4a).
 *
 * `26e16a42`(2026-05-22)가 이 테스트를 지우고 행 클릭을 껐다. 사유는 커밋 제목의
 * "읽기 전용 그리드" 한 줄뿐이고, 그때는 화면이 시트를 보여주기만 했으니 맞았다.
 * PR4 부터 원장이 원천이고 **편집·변경 이력·되돌리기가 전부 인스펙터 안에 있다** —
 * 행이 안 열리면 거기 닿을 길이 없다.
 */
describe("AssignmentsTable — 행 클릭", () => {
  it("행을 클릭하면 onSelect(row) 가 불린다", () => {
    const onSelect = vi.fn();
    const row = makeRow();
    render(
      <AssignmentsTable rows={[row]} selectedId={null} onSelect={onSelect} />,
    );
    fireEvent.click(screen.getByText("가천대학교"));
    expect(onSelect).toHaveBeenCalledWith(row);
  });

  /** CLAUDE.md 인터랙션 표준 — 목록 항목형의 호버·선택. 텍스트만 보면 표준 위반이 통과한다. */
  it("호버·선택 표준 클래스를 쓴다", () => {
    const row = makeRow();
    const { rerender } = render(
      <AssignmentsTable rows={[row]} selectedId={null} onSelect={vi.fn()} />,
    );
    const tr = screen.getByText("가천대학교").closest("tr")!;
    expect(tr.className).toContain("hover:bg-line-soft");
    expect(tr.className).toContain("cursor-pointer");

    rerender(
      <AssignmentsTable rows={[row]} selectedId={row.id} onSelect={vi.fn()} />,
    );
    const selected = screen.getByText("가천대학교").closest("tr")!;
    for (const cls of [
      "border-vermilion",
      "bg-vermilion/10",
      "text-vermilion",
    ]) {
      expect(selected.className).toContain(cls);
    }
  });
});

describe("AssignmentsTable — 배지", () => {
  it("연결 안 됨은 글자와 주의 톤 클래스를 함께 그린다", () => {
    render(
      <AssignmentsTable
        rows={[
          makeRow({
            assignment: {
              academicYear: 2027,
              byService: {},
              badges: ["연결 안 됨"],
            },
          }),
        ]}
        selectedId={null}
        onSelect={vi.fn()}
      />,
    );
    const badge = screen.getByText("연결 안 됨");
    expect(badge.className).toContain(ASSIGNMENT_BADGE_TONE["연결 안 됨"]);
  });

  it("배지가 여럿이면 다 그린다", () => {
    render(
      <AssignmentsTable
        rows={[
          makeRow({
            assignment: {
              academicYear: 2027,
              byService: {},
              badges: ["연결 안 됨", "분할"],
            },
          }),
        ]}
        selectedId={null}
        onSelect={vi.fn()}
      />,
    );
    expect(screen.getByText("연결 안 됨")).toBeInTheDocument();
    expect(screen.getByText("분할")).toBeInTheDocument();
  });

  it("배지가 없으면 배지를 안 그린다", () => {
    render(
      <AssignmentsTable
        rows={[makeRow()]}
        selectedId={null}
        onSelect={vi.fn()}
      />,
    );
    expect(screen.queryByText("연결 안 됨")).toBeNull();
    expect(screen.queryByText("분할")).toBeNull();
    expect(screen.queryByText("미배정")).toBeNull();
  });
});

describe("AssignmentsTable", () => {
  it("헤더 — '대학' + 5개 서비스 종류 노출", () => {
    render(
      <AssignmentsTable
        rows={[makeRow()]}
        selectedId={null}
        onSelect={vi.fn()}
      />,
    );
    expect(screen.getByText("대학")).toBeInTheDocument();
    expect(screen.getByText("학부")).toBeInTheDocument();
    expect(screen.getByText("대학원")).toBeInTheDocument();
    expect(screen.getByText("PIMS")).toBeInTheDocument();
    expect(screen.getByText("성적산출")).toBeInTheDocument();
    expect(screen.getByText("상담앱")).toBeInTheDocument();
  });

  it("operator+developer 있는 셀 — '{op} / {dev}' 형식 (접두어 없음)", () => {
    render(
      <AssignmentsTable
        rows={[makeRow()]}
        selectedId={null}
        onSelect={vi.fn()}
      />,
    );
    // 원서접수: operator=홍길동, developer=이순신
    expect(screen.getByText("홍길동 / 이순신")).toBeInTheDocument();
    // '운'/'개' 접두어는 제거됨
    expect(screen.queryByText(/운 홍길동/)).toBeNull();
  });

  it("operator만 있는 셀(developer 빈 문자열) — 운영자 이름만 표시", () => {
    render(
      <AssignmentsTable
        rows={[makeRow()]}
        selectedId={null}
        onSelect={vi.fn()}
      />,
    );
    // PIMS: operator=강감찬, developer="" → 이름만, '운' 접두어 없음
    expect(screen.getByText("강감찬")).toBeInTheDocument();
    expect(screen.queryByText(/운 강감찬/)).toBeNull();
  });

  it("배정 없는 서비스 셀 — '—' 표시", () => {
    render(
      <AssignmentsTable
        rows={[makeRow()]}
        selectedId={null}
        onSelect={vi.fn()}
      />,
    );
    // 대학원, 성적산출, 상담앱은 byService에 없으므로 '—' 3개
    const dashes = screen.getAllByText("—");
    expect(dashes.length).toBeGreaterThanOrEqual(3);
  });

  /**
   * **가드 테스트다** — 이 렌더는 원서접수 하위유형 때문에 이미 있었다. RED 를
   * 거치지 않았고, 대신 `parsePims` 가 `subtypes` 를 내보내기 시작한 변경이
   * 화면까지 닿는다는 것을 여기서 고정한다(2026-09-15).
   *
   * 파서와 이 칸은 서로를 모른다 — `_row-mapper` 가 `subtypes` 를 그대로 넘겨
   * 이어질 뿐이다. 한쪽만 바뀌면 PIMS 칸이 말없이 한 줄로 돌아가는데, 값은
   * 그대로라 화면이 멀쩡해 보인다.
   */
  it("PIMS 칸은 FULL·환충을 줄로 나눠 보여준다 — 두 칸은 독립된 배정이다", () => {
    render(
      <AssignmentsTable
        rows={[
          makeRow({
            assignment: {
              academicYear: 2027,
              byService: {
                PIMS: {
                  operator: "강감찬",
                  developer: "",
                  detail: [],
                  subtypes: [
                    { label: "FULL", operator: "강감찬", developer: "" },
                    { label: "환충", operator: "을지문덕", developer: "" },
                  ],
                },
              },
            },
          }),
        ]}
        selectedId={null}
        onSelect={vi.fn()}
      />,
    );
    expect(screen.getByText("FULL")).toBeInTheDocument();
    expect(screen.getByText("환충")).toBeInTheDocument();
    expect(screen.getByText("강감찬")).toBeInTheDocument();
    expect(screen.getByText("을지문덕")).toBeInTheDocument();
  });

  it("대학명(name) 렌더", () => {
    render(
      <AssignmentsTable
        rows={[makeRow({ name: "세종대학교" })]}
        selectedId={null}
        onSelect={vi.fn()}
      />,
    );
    expect(screen.getByText("세종대학교")).toBeInTheDocument();
  });
});
