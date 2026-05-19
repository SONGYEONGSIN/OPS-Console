import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { EventTicker } from "../EventTicker";

describe("EventTicker", () => {
  it("이벤트 라벨 모두 노출", () => {
    render(
      <EventTicker
        events={[
          { id: "1", label: "350ms 결제" },
          { id: "2", label: "D-3 건축대" },
          { id: "3", label: "#INC-042 처리완료" },
        ]}
      />,
    );
    expect(screen.getByText(/350ms 결제/)).toBeInTheDocument();
    expect(screen.getByText(/D-3 건축대/)).toBeInTheDocument();
    expect(screen.getByText(/#INC-042 처리완료/)).toBeInTheDocument();
  });

  it("빈 배열 — 안내 텍스트", () => {
    render(<EventTicker events={[]} />);
    expect(screen.getByText(/이벤트 없음/)).toBeInTheDocument();
  });
});
