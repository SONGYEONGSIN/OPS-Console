import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { TriageList } from "../TriageList";
import type { DashWidget } from "../../patterns/DashPattern";

const sampleWidgets: DashWidget[] = [
  { id: "A", tone: "urgent", label: "결제 지연",     value: "350ms", time: "14:23" },
  { id: "B", tone: "ok",     label: "정상",          value: "47건", time: "24h" },
  { id: "C", tone: "urgent", label: "사고 보고",      value: "2건",  time: "오늘" },
  { id: "D", tone: "review", label: "처리 대기",      value: "12건", time: "현재" },
  { id: "E", tone: "urgent", label: "긴급 알림",      value: "3건",  time: "1h" },
  { id: "F", tone: "urgent", label: "TLS 만료",       value: "2개",  time: "30일" },
  { id: "G", tone: "urgent", label: "DB 임계 초과",   value: "1.4%", time: "5m" },
];

describe("TriageList", () => {
  it("urgent 톤 위젯만 노출 (ok/review 제외)", () => {
    render(<TriageList widgets={sampleWidgets} max={4} />);
    expect(screen.getByText("결제 지연")).toBeInTheDocument();
    expect(screen.getByText("사고 보고")).toBeInTheDocument();
    expect(screen.queryByText("정상")).not.toBeInTheDocument();
    expect(screen.queryByText("처리 대기")).not.toBeInTheDocument();
  });

  it("max=4로 제한 (urgent 5개 입력 시 4개만)", () => {
    render(<TriageList widgets={sampleWidgets} max={4} />);
    expect(screen.queryByText("DB 임계 초과")).not.toBeInTheDocument();
  });

  it("urgent 0건이면 'currently 정상' 안내", () => {
    const allOk: DashWidget[] = [
      { id: "X", tone: "ok", label: "정상", value: "47건", time: "24h" },
    ];
    render(<TriageList widgets={allOk} max={4} />);
    expect(screen.getByText(/정상/)).toBeInTheDocument();
  });

  it("위젯 value/time 함께 노출", () => {
    render(<TriageList widgets={sampleWidgets} max={4} />);
    expect(screen.getByText("350ms")).toBeInTheDocument();
    expect(screen.getByText("14:23")).toBeInTheDocument();
  });
});
