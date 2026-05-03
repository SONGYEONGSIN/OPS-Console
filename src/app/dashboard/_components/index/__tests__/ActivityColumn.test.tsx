import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ActivityColumn } from "../ActivityColumn";
import type { DashboardActivity } from "../../../_data/patterns";

const sampleActivities: DashboardActivity[] = [
  { time: "16:42", who: "박지연", act: "PIMS 접수폼 검증 작업 진행" },
  { time: "16:38", who: "김민수", act: "사고 보고 #INC-042 처리 완료" },
  { time: "16:30", who: "정시현", act: "데이터 요청 응답 발송" },
  { time: "16:22", who: "이해영", act: "내부관리자 권한 분리 작업 시작" },
];

describe("ActivityColumn", () => {
  it("모든 활동 항목 렌더 (time/who/act)", () => {
    render(<ActivityColumn items={sampleActivities} />);
    sampleActivities.forEach((a) => {
      expect(screen.getByText(a.time)).toBeInTheDocument();
      expect(screen.getByText(a.who)).toBeInTheDocument();
      expect(screen.getByText(a.act)).toBeInTheDocument();
    });
  });

  it("4개 활동 → 4개 list item 노출", () => {
    const { container } = render(<ActivityColumn items={sampleActivities} />);
    expect(container.querySelectorAll("li").length).toBe(4);
  });

  it("빈 배열 입력 시 'no activity' 안내", () => {
    render(<ActivityColumn items={[]} />);
    expect(screen.getByText(/활동 없음|no activity/i)).toBeInTheDocument();
  });
});
