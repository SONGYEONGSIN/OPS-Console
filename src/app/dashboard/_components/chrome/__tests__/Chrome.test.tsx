import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { Chrome } from "../Chrome";

vi.mock("../SessionTimer", () => ({ SessionTimer: () => <div>15:00</div> }));
vi.mock("../../AlertsBell", () => ({ AlertsBell: () => <div>알림</div> }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

const operator = {
  email: "ys1114@jinhakapply.com",
  operator: null,
  displayName: "송영신",
  role: "팀장",
  team: "운영2팀" as const,
};

describe("Chrome", () => {
  it("좌측 PIVOT brand 노출", () => {
    render(<Chrome operator={operator} alerts={[]} />);
    expect(screen.getByText("PIVOT")).toBeInTheDocument();
    expect(screen.getByText("OPS DESK")).toBeInTheDocument();
  });

  it("우측 사용자 풀네임 + 부제 노출", () => {
    render(<Chrome operator={operator} alerts={[]} />);
    expect(screen.getByText("송영신")).toBeInTheDocument();
    expect(screen.getByText("운영2팀 · 팀장")).toBeInTheDocument();
  });
});
