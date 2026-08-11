import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { DevTestTable } from "../Table";
import type { ListRow } from "../../../../patterns/ListPattern";
import { BADGE_TONE } from "../../badge-tone";

function row(partial: Partial<ListRow>): ListRow {
  return {
    id: partial.id ?? "s1",
    name: "수시",
    status: "active",
    owner: "",
    universityName: "서강대",
    serviceName: "수시모집",
    ...partial,
  };
}

describe("DevTestTable", () => {
  it("대학·서비스명과 최근 테스트 상태 배지를 렌더한다", () => {
    const rows = [
      row({
        id: "a",
        entertestRuns: [
          {
            id: "r1",
            service_id: 1,
            status: "done",
            requested_by: "kim",
            requested_at: "2026-06-18T09:00:00Z",
            result: null,
            error_message: null,
          } as ListRow["entertestRuns"] extends (infer R)[] ? R : never,
        ],
      }),
      row({ id: "b", entertestRuns: [] }),
    ];
    render(<DevTestTable rows={rows} selectedId={null} onSelect={vi.fn()} />);
    expect(screen.getAllByText("서강대").length).toBeGreaterThan(0);
    expect(screen.getByText("완료")).toBeInTheDocument();
    // 이력 없는 행은 '-'
    expect(screen.getAllByText("미실행").length).toBeGreaterThan(0);
  });

  it("행 클릭 시 onSelect 호출", () => {
    const onSelect = vi.fn();
    render(
      <DevTestTable
        rows={[row({ id: "a" })]}
        selectedId={null}
        onSelect={onSelect}
      />,
    );
    screen.getByText("수시모집").click();
    expect(onSelect).toHaveBeenCalled();
  });
});

type Run = ListRow["entertestRuns"] extends (infer R)[] ? R : never;

function runWith(status: string): Run {
  return {
    id: "r1",
    service_id: 1,
    status,
    requested_by: "kim",
    requested_at: "2026-06-18T09:00:00Z",
    result: null,
    error_message: null,
  } as Run;
}

describe("DevTestTable — 상태 배지 톤", () => {
  it("완료는 완료 톤(검정)이다", () => {
    render(
      <DevTestTable
        rows={[row({ id: "a", entertestRuns: [runWith("done")] })]}
        selectedId={null}
        onSelect={vi.fn()}
      />,
    );
    expect(screen.getByText("완료").className).toContain(BADGE_TONE.done);
  });

  it("오류는 주의 톤이다 — 실패와 같은 색이어야 한다", () => {
    render(
      <DevTestTable
        rows={[row({ id: "a", entertestRuns: [runWith("error")] })]}
        selectedId={null}
        onSelect={vi.fn()}
      />,
    );
    expect(screen.getByText("오류").className).toContain(BADGE_TONE.attention);
  });

  it("실행 중은 진행 톤이다", () => {
    render(
      <DevTestTable
        rows={[row({ id: "a", entertestRuns: [runWith("running")] })]}
        selectedId={null}
        onSelect={vi.fn()}
      />,
    );
    expect(screen.getByText("실행 중").className).toContain(
      BADGE_TONE.progress,
    );
  });
});
