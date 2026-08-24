import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { InspectorDashBody } from "../InspectorDashBody";
import type { DashWidget } from "../../patterns/DashPattern";

const fixture: DashWidget = {
  id: "alert-1",
  label: "긴급 알림",
  value: "1건",
  time: "14:30",
  tone: "urgent",
};

describe("InspectorDashBody", () => {
  it("read 모드 — 데이터 read-only 표시", () => {
    render(
      <InspectorDashBody widget={fixture} editing={false} onSave={vi.fn()} onCancel={vi.fn()} />
    );
    expect(screen.getByText("긴급 알림")).toBeInTheDocument();
    expect(screen.getByText("1건")).toBeInTheDocument();
    expect(screen.getByText("14:30")).toBeInTheDocument();
    expect(screen.queryByRole("textbox")).toBeNull();
  });

  it("edit + 저장 — onSave(next) 호출", () => {
    const onSave = vi.fn();
    render(
      <InspectorDashBody widget={fixture} editing={true} onSave={onSave} onCancel={vi.fn()} />
    );
    fireEvent.change(screen.getByLabelText("라벨"), { target: { value: "검토 알림" } });
    fireEvent.click(screen.getByRole("button", { name: /저장/ }));
    expect(onSave).toHaveBeenCalledWith({ ...fixture, label: "검토 알림" });
  });

  it("취소 — onCancel 호출", () => {
    const onCancel = vi.fn();
    render(
      <InspectorDashBody widget={fixture} editing={true} onSave={vi.fn()} onCancel={onCancel} />
    );
    fireEvent.click(screen.getByRole("button", { name: /취소/ }));
    expect(onCancel).toHaveBeenCalledOnce();
  });
});

/**
 * 날짜·시각도 숫자다 — 기본 폰트 + `tabular-nums`. `font-mono` 는 문자가 섞인
 * 값 전용(UUID·경로·명령어)이고, 숫자만 다른 글꼴이면 그 칸이 혼자 튄다.
 */
describe("InspectorDashBody — 시각 표기", () => {
  it("시각은 기본 폰트에 tabular-nums 다", () => {
    render(
      <InspectorDashBody widget={fixture} editing={false} onSave={vi.fn()} onCancel={vi.fn()} />
    );
    const el = screen.getByText("14:30");
    expect(el.className).toContain("tabular-nums");
    expect(el.className).not.toContain("font-mono");
  });
});
