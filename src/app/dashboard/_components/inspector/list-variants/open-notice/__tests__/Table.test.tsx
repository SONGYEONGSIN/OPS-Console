import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { OpenNoticeTable, isWriteStartPast } from "../Table";
import type { ListRow } from "../../../../patterns/ListPattern";

function row(over: Partial<ListRow> = {}): ListRow {
  return {
    id: "1130058",
    name: "2027학년도 수시모집",
    status: "active",
    owner: "",
    universityName: "조선대학교",
    serviceName: "2027학년도 수시모집",
    operatorName: "홍길동",
    writeStartAt: "2099-09-08T01:00:00Z",
    ...over,
  };
}

describe("isWriteStartPast", () => {
  const now = new Date("2026-09-10T00:00:00Z");
  it("접수시작이 지났으면 true", () => {
    expect(isWriteStartPast("2026-09-01T00:00:00Z", now)).toBe(true);
  });
  it("아직이면 false", () => {
    expect(isWriteStartPast("2026-09-20T00:00:00Z", now)).toBe(false);
  });
  it("값이 없으면 false", () => {
    expect(isWriteStartPast(null, now)).toBe(false);
    expect(isWriteStartPast(undefined, now)).toBe(false);
  });
});

describe("OpenNoticeTable", () => {
  it("비어 있으면 안내 문구", () => {
    render(<OpenNoticeTable rows={[]} selectedId={null} onSelect={vi.fn()} />);
    expect(screen.getByText("대상 서비스가 없습니다.")).toBeInTheDocument();
  });

  it("이력이 없으면 상태가 —", () => {
    render(<OpenNoticeTable rows={[row()]} selectedId={null} onSelect={vi.fn()} />);
    expect(screen.queryByText("발송완료")).not.toBeInTheDocument();
    expect(screen.queryByText("자동 발송 켬")).not.toBeInTheDocument();
    expect(screen.queryByText("발송실패")).not.toBeInTheDocument();
  });

  it("sent 면 발송완료 배지 + 발송일시", () => {
    render(
      <OpenNoticeTable
        rows={[row({ openNoticeStatus: "sent", openNoticeLastSentAt: "2026-09-01T04:30:00Z" })]}
        selectedId={null}
        onSelect={vi.fn()}
      />,
    );
    expect(screen.getByText("발송완료")).toBeInTheDocument();
    expect(screen.getByText("09-01 13:30")).toBeInTheDocument();
  });

  it("scheduled 면 '자동 발송 켬' 배지", () => {
    render(
      <OpenNoticeTable
        rows={[row({ openNoticeStatus: "scheduled" })]}
        selectedId={null}
        onSelect={vi.fn()}
      />,
    );
    expect(screen.getByText("자동 발송 켬")).toBeInTheDocument();
  });

  it("실패 이력만 있으면 '발송실패' 배지 — 자동이라 아무도 안 보고 있다", () => {
    render(
      <OpenNoticeTable
        rows={[row({ openNoticeLastFailedAt: "2026-09-01T04:30:00Z" })]}
        selectedId={null}
        onSelect={vi.fn()}
      />,
    );
    expect(screen.getByText("발송실패")).toBeInTheDocument();
  });

  it("발송 성공이 있으면 실패 이력이 있어도 발송완료가 이긴다", () => {
    render(
      <OpenNoticeTable
        rows={[
          row({
            openNoticeStatus: "sent",
            openNoticeLastSentAt: "2026-09-02T04:30:00Z",
            openNoticeLastFailedAt: "2026-09-01T04:30:00Z",
          }),
        ]}
        selectedId={null}
        onSelect={vi.fn()}
      />,
    );
    expect(screen.getByText("발송완료")).toBeInTheDocument();
    expect(screen.queryByText("발송실패")).not.toBeInTheDocument();
  });

  it("정상 행은 클릭하면 선택된다", () => {
    const onSelect = vi.fn();
    render(<OpenNoticeTable rows={[row()]} selectedId={null} onSelect={onSelect} />);
    fireEvent.click(screen.getByText("조선대학교"));
    expect(onSelect).toHaveBeenCalledTimes(1);
  });

  it("오픈 시각이 지난 행은 비활성 — 클릭해도 선택되지 않는다", () => {
    // 토글을 못 켠 채 오픈된 건. 보이되 손댈 수는 없어야 한다.
    const onSelect = vi.fn();
    render(
      <OpenNoticeTable
        rows={[row({ writeStartAt: "2020-01-01T00:00:00Z" })]}
        selectedId={null}
        onSelect={onSelect}
      />,
    );
    const tr = screen.getByText("조선대학교").closest("tr")!;
    expect(tr).toHaveAttribute("aria-disabled", "true");
    expect(tr.className).toContain("cursor-not-allowed");
    fireEvent.click(screen.getByText("조선대학교"));
    expect(onSelect).not.toHaveBeenCalled();
  });
});
