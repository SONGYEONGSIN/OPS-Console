import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { InspectorChrome } from "../InspectorChrome";
import type { ListRow } from "../../patterns/ListPattern";

function makeRow(over: Partial<ListRow> = {}): ListRow {
  return {
    id: "33bd97a3-a243-4896-a242-ca6b0edb62f4",
    name: "주간 운영 회의",
    status: "active",
    owner: "김지나",
    meta: "팀 공통",
    ...over,
  };
}

describe("InspectorChrome", () => {
  it("'인스펙터 · 항목 상세' 라벨 + title + id (대문자) 표시", () => {
    render(
      <InspectorChrome row={makeRow()} editing={false} onToggleEdit={vi.fn()}>
        <div>body</div>
      </InspectorChrome>,
    );
    expect(screen.getByText("인스펙터 · 항목 상세")).toBeInTheDocument();
    expect(screen.getByText("주간 운영 회의")).toBeInTheDocument();
    expect(
      screen.getByText(/33BD97A3-A243-4896-A242-CA6B0EDB62F4/),
    ).toBeInTheDocument();
  });

  it("meta가 있으면 id 옆에 ' · meta' 표시", () => {
    render(
      <InspectorChrome row={makeRow({ meta: "팀 공통" })} editing={false} onToggleEdit={vi.fn()}>
        <div />
      </InspectorChrome>,
    );
    expect(screen.getByText(/팀 공통/)).toBeInTheDocument();
  });

  it("editable=true + editing=false → '구성 편집' 버튼 클릭 → onToggleEdit 호출", () => {
    const onToggleEdit = vi.fn();
    render(
      <InspectorChrome row={makeRow()} editing={false} onToggleEdit={onToggleEdit}>
        <div />
      </InspectorChrome>,
    );
    fireEvent.click(screen.getByRole("button", { name: "구성 편집" }));
    expect(onToggleEdit).toHaveBeenCalledOnce();
  });

  it("editing=true이면 '읽기 모드' 버튼 노출", () => {
    render(
      <InspectorChrome row={makeRow()} editing={true} onToggleEdit={vi.fn()}>
        <div />
      </InspectorChrome>,
    );
    expect(screen.getByRole("button", { name: "읽기 모드" })).toBeInTheDocument();
  });

  it("editable=false면 toggle 버튼 hidden", () => {
    render(
      <InspectorChrome row={makeRow()} editing={false} editable={false} onToggleEdit={vi.fn()}>
        <div />
      </InspectorChrome>,
    );
    expect(screen.queryByRole("button", { name: /(구성 편집|읽기 모드)/ })).toBeNull();
  });

  it("children body 렌더링", () => {
    render(
      <InspectorChrome row={makeRow()} editing={false} onToggleEdit={vi.fn()}>
        <p>본문 컨텐츠</p>
      </InspectorChrome>,
    );
    expect(screen.getByText("본문 컨텐츠")).toBeInTheDocument();
  });
});
