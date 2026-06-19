import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import type { ReactNode } from "react";

vi.mock("@/features/closing/scrape-requests/actions", () => ({
  requestLocalScrapeAction: vi.fn(),
}));

import { LocalScrapeRequest } from "../LocalScrapeRequest";
import { requestLocalScrapeAction } from "@/features/closing/scrape-requests/actions";
import type { ScrapeRequest } from "@/features/closing/scrape-requests/schemas";

const baseReq: ScrapeRequest = {
  id: "11111111-1111-4111-8111-111111111111",
  requested_at: "2026-06-17T05:00:00Z",
  requested_by: "admin@example.com",
  status: "pending",
  claimed_at: null,
  finished_at: null,
  message: null,
  created_at: "2026-06-17T05:00:00Z",
};

// <tr>는 table 컨텍스트에서만 유효 — 래퍼로 감싸 렌더.
function renderRow(node: ReactNode) {
  return render(
    <table>
      <tbody>{node}</tbody>
    </table>,
  );
}

describe("LocalScrapeRequest", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("제목과 '로컬 실행' 버튼을 렌더한다", () => {
    renderRow(<LocalScrapeRequest latest={null} isAdmin={true} />);
    expect(
      screen.getByText("서비스 마감 — 로컬 수동 실행"),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /로컬 실행/ }),
    ).toBeInTheDocument();
  });

  it("최근 요청 상태(pending)를 표시한다", () => {
    renderRow(<LocalScrapeRequest latest={baseReq} isAdmin={true} />);
    expect(screen.getByText(/대기 중/)).toBeInTheDocument();
  });

  it("실패 상태를 표시한다", () => {
    renderRow(
      <LocalScrapeRequest
        latest={{ ...baseReq, status: "failed", message: "exit 1" }}
        isAdmin={true}
      />,
    );
    expect(screen.getByText(/실패/)).toBeInTheDocument();
  });

  it("비admin이 요청 클릭 시 알럿 + 액션 미호출", () => {
    const alertSpy = vi.spyOn(window, "alert").mockImplementation(() => {});
    renderRow(<LocalScrapeRequest latest={null} isAdmin={false} />);
    fireEvent.click(screen.getByRole("button", { name: /로컬 실행/ }));
    expect(alertSpy).toHaveBeenCalledWith("관리자만 실행 가능합니다.");
    expect(requestLocalScrapeAction).not.toHaveBeenCalled();
    alertSpy.mockRestore();
  });
});
