import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ServicesPagination } from "../ServicesPagination";

const push = vi.fn();
const useSearchParamsMock = vi.fn(() => new URLSearchParams());

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
  useSearchParams: () => useSearchParamsMock(),
  usePathname: () => "/dashboard/services",
}));

describe("ServicesPagination", () => {
  beforeEach(() => {
    push.mockClear();
    useSearchParamsMock.mockReturnValue(new URLSearchParams());
  });

  it("total ≤ pageSize면 미노출", () => {
    const { container } = render(
      <ServicesPagination total={15} pageSize={30} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("total > pageSize면 prev/next + N/M 노출", () => {
    render(<ServicesPagination total={2511} pageSize={30} />);
    expect(screen.getByRole("button", { name: /이전/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /다음/ })).toBeInTheDocument();
    expect(screen.getByText(/1\s*\/\s*84/)).toBeInTheDocument();
  });

  it("다음 클릭 → ?page=2", () => {
    render(<ServicesPagination total={2511} pageSize={30} />);
    fireEvent.click(screen.getByRole("button", { name: /다음/ }));
    expect(push).toHaveBeenCalledWith(expect.stringContaining("page=2"));
  });

  it("첫 페이지에서 이전 disabled", () => {
    render(<ServicesPagination total={2511} pageSize={30} />);
    expect(screen.getByRole("button", { name: /이전/ })).toBeDisabled();
  });

  it("마지막 페이지에서 다음 disabled", () => {
    useSearchParamsMock.mockReturnValue(new URLSearchParams("page=84"));
    render(<ServicesPagination total={2511} pageSize={30} />);
    expect(screen.getByRole("button", { name: /다음/ })).toBeDisabled();
  });
});
