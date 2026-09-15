import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import type { ListRow } from "../../../../patterns/ListPattern";
import { AssignmentsTable } from "../Table";

const makeRow = (overrides: Partial<ListRow> = {}): ListRow => ({
  id: "aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa",
  name: "가천대학교",
  status: "active",
  owner: "",
  assignment: {
    byService: {
      원서접수: { operator: "홍길동", developer: "이순신", detail: [] },
      PIMS: { operator: "강감찬", developer: "", detail: [] },
    },
  },
  ...overrides,
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
