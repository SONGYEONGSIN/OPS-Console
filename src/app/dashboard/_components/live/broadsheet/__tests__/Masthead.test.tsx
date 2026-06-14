import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

const push = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
  usePathname: () => "/dashboard",
  useSearchParams: () => new URLSearchParams(""),
}));

import { Masthead } from "../Masthead";

describe("Masthead", () => {
  it("renders brand, org, scope toggle, system log toggle, clock", () => {
    render(<Masthead mine activityLog={[]} />);
    expect(screen.getByText("운영부 상황실")).toBeInTheDocument();
    expect(screen.getByText("어플라이 · 운영부")).toBeInTheDocument();
    expect(screen.getByText("시스템 로그")).toBeInTheDocument();
    expect(screen.getByText("내 담당")).toBeInTheDocument();
    expect(screen.getByText("LIVE")).toBeInTheDocument();
  });
});
