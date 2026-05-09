import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { DashPattern } from "../DashPattern";
import type { DashWidget } from "../DashPattern";

const sampleWidgets: DashWidget[] = [
  { id: "W-001", tone: "urgent", label: "긴급 위젯", value: "12", time: "10:00" },
  { id: "W-002", tone: "ok", label: "정상 위젯", value: "85%", time: "10:30" },
  { id: "W-003", tone: "review", label: "점검 위젯", value: "3", time: "11:00" },
];

describe("DashPattern", () => {
  it("title heading + count 노출 (기존 UI 보존)", () => {
    render(<DashPattern title="운영 현황" data={{ widgets: sampleWidgets }} />);
    expect(
      screen.getByRole("heading", { name: /운영 현황 · 3건/, level: 2 }),
    ).toBeInTheDocument();
  });

  it("Demo 주석 노출 (기존 UI 보존)", () => {
    render(<DashPattern title="운영 현황" data={{ widgets: sampleWidgets }} />);
    expect(screen.getByText(/Demo · 실제 데이터 미연결/)).toBeInTheDocument();
  });

  it("위젯 카드 모두 렌더 + tone 라벨 한국어", () => {
    render(<DashPattern title="운영 현황" data={{ widgets: sampleWidgets }} />);
    expect(screen.getByText("긴급 위젯")).toBeInTheDocument();
    expect(screen.getByText("정상 위젯")).toBeInTheDocument();
    expect(screen.getByText("점검 위젯")).toBeInTheDocument();
    expect(screen.getByText("긴급")).toBeInTheDocument();
    expect(screen.getByText("정상")).toBeInTheDocument();
    expect(screen.getByText("점검")).toBeInTheDocument();
  });

  it("초기 상태 — Inspector 닫혀있음 (aria-hidden)", () => {
    render(<DashPattern title="운영 현황" data={{ widgets: sampleWidgets }} />);
    const panel = screen.getByRole("complementary", { hidden: true });
    expect(panel).toHaveAttribute("aria-hidden", "true");
  });

  it("위젯 클릭 → Inspector 열림 + 선택 위젯 정보 노출 (h3)", () => {
    render(<DashPattern title="운영 현황" data={{ widgets: sampleWidgets }} />);
    fireEvent.click(screen.getByText("긴급 위젯"));
    const panel = screen.getByRole("complementary");
    expect(panel).toHaveAttribute("aria-hidden", "false");
    expect(
      screen.getByRole("heading", { name: "긴급 위젯", level: 3 }),
    ).toBeInTheDocument();
  });

  it("위젯 클릭 → 편집 버튼 노출", () => {
    render(<DashPattern title="운영 현황" data={{ widgets: sampleWidgets }} />);
    fireEvent.click(screen.getByText("긴급 위젯"));
    expect(screen.getByRole("button", { name: /편집/ })).toBeInTheDocument();
  });

  it("편집 → 라벨 수정 → 저장 시 위젯 갱신 + 패널 닫힘", () => {
    render(<DashPattern title="운영 현황" data={{ widgets: sampleWidgets }} />);
    fireEvent.click(screen.getByText("긴급 위젯"));
    fireEvent.click(screen.getByRole("button", { name: /편집/ }));
    const labelInput = screen.getByLabelText("라벨");
    fireEvent.change(labelInput, { target: { value: "수정된 위젯" } });
    fireEvent.click(screen.getByRole("button", { name: "저장" }));

    const panel = screen.getByRole("complementary", { hidden: true });
    expect(panel).toHaveAttribute("aria-hidden", "true");
    expect(screen.getByText("수정된 위젯")).toBeInTheDocument();
    expect(screen.queryByText("긴급 위젯")).not.toBeInTheDocument();
  });

  it("선택된 위젯 — 시각적으로 강조 (ring 클래스 또는 aria-pressed)", () => {
    render(<DashPattern title="운영 현황" data={{ widgets: sampleWidgets }} />);
    const card = screen.getByText("정상 위젯").closest("button");
    fireEvent.click(card!);
    expect(card).toHaveAttribute("aria-pressed", "true");
  });
});
