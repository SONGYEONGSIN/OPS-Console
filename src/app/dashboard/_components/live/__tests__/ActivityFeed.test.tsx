import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ActivityFeed } from "../ActivityFeed";

describe("ActivityFeed", () => {
  it("이벤트 row 노출 (시각·사람·내용)", () => {
    render(
      <ActivityFeed
        items={[
          { id: "1", ts: "14:23", who: "송영석", what: "계약 승인" },
          { id: "2", ts: "14:22", who: "김유민", what: "알림 47건" },
        ]}
      />,
    );
    expect(screen.getByText("14:23")).toBeInTheDocument();
    expect(screen.getByText("송영석")).toBeInTheDocument();
    expect(screen.getByText("계약 승인")).toBeInTheDocument();
    expect(screen.getByText(/알림 47건/)).toBeInTheDocument();
  });

  it("빈 배열 — 안내 텍스트", () => {
    render(<ActivityFeed items={[]} />);
    expect(screen.getByText(/활동 없음/)).toBeInTheDocument();
  });
});
