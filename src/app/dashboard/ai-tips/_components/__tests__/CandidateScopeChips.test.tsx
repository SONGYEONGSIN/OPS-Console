import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { CandidateScopeChips } from "../CandidateScopeChips";

const push = vi.fn();
let mockParams = new URLSearchParams();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
  usePathname: () => "/dashboard/ai-tips",
  useSearchParams: () => mockParams,
}));

const counts = { pending: 7, hidden: 3, promoted: 12 };

describe("CandidateScopeChips — 후보 상태 칩", () => {
  beforeEach(() => {
    push.mockReset();
    mockParams = new URLSearchParams();
  });

  it("칩 셋과 각 건수를 보여준다", () => {
    render(<CandidateScopeChips counts={counts} />);
    expect(
      screen.getByRole("button", { name: /검토 대기/ }),
    ).toHaveTextContent("7");
    expect(screen.getByRole("button", { name: /숨김/ })).toHaveTextContent("3");
    expect(screen.getByRole("button", { name: /등록됨/ })).toHaveTextContent(
      "12",
    );
  });

  it("scope 미지정이면 검토 대기가 활성 — 평소에 볼 것은 그것뿐이다", () => {
    render(<CandidateScopeChips counts={counts} />);
    expect(screen.getByRole("button", { name: /검토 대기/ })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByRole("button", { name: /숨김/ })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
    expect(screen.getByRole("button", { name: /등록됨/ })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
  });

  it("scope 가 지정되면 그 칩이 활성", () => {
    mockParams = new URLSearchParams("scope=hidden");
    render(<CandidateScopeChips counts={counts} />);
    expect(screen.getByRole("button", { name: /숨김/ })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByRole("button", { name: /검토 대기/ })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
  });

  it("칩을 누르면 page 가 지워진다 — 3쪽에서 옮기면 빈 화면이 뜬다", () => {
    mockParams = new URLSearchParams("scope=hidden&q=claude&page=3");
    render(<CandidateScopeChips counts={counts} />);
    fireEvent.click(screen.getByRole("button", { name: /등록됨/ }));
    const url = new URL(push.mock.calls[0][0], "http://x");
    expect(url.pathname).toBe("/dashboard/ai-tips");
    expect(url.searchParams.get("scope")).toBe("promoted");
    expect(url.searchParams.get("q")).toBe("claude");
    expect(url.searchParams.has("page")).toBe(false);
  });

  it("기본값으로 돌아갈 땐 scope 를 지운다 — 주소에 기본값을 적지 않는다", () => {
    mockParams = new URLSearchParams("scope=promoted");
    render(<CandidateScopeChips counts={counts} />);
    fireEvent.click(screen.getByRole("button", { name: /검토 대기/ }));
    const url = new URL(push.mock.calls[0][0], "http://x");
    expect(url.searchParams.has("scope")).toBe(false);
  });
});
