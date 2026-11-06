import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { Component, type ReactNode } from "react";

const refresh = vi.fn();
vi.mock("@/features/sms-sender/actions", () => ({
  refreshSmsSenderCache: () => refresh(),
}));

import { HEADER_ACTION_CLASS } from "@/components/common/HeaderActionButton";
import { SourceBar, SourceError } from "../_components/SourceBar";

class Boundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? <p>경계에 걸림</p> : this.props.children;
  }
}

const base = {
  fileName: "SMS 발신번호 사전등록 현황_261017.xlsm",
  fetchedAt: "2026-10-26T00:05:00Z",
  criteria: null as string[][] | null,
};

describe("SourceBar", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    refresh.mockResolvedValue({ ok: true });
  });

  it("파일 꼬리와 KST 기준 시각", () => {
    render(<SourceBar {...base} />);
    expect(
      screen.getByText("현황 파일 _261017.xlsm · 기준 09:05"),
    ).toBeInTheDocument();
  });

  it("새로고침은 action 을 부르고 실패 문구를 보인다", async () => {
    refresh.mockResolvedValue({ ok: false, error: "권한 없음 — 관리자만" });
    render(<SourceBar {...base} />);
    fireEvent.click(screen.getByRole("button", { name: "새로고침" }));
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(await screen.findByText("권한 없음 — 관리자만")).toBeInTheDocument();
  });

  it("action 이 던져도 페이지는 살아 있고 같은 자리에 실패 문구", async () => {
    refresh.mockRejectedValue(new Error("network down"));
    const quiet = vi.spyOn(console, "error").mockImplementation(() => {});
    render(
      <Boundary>
        <SourceBar {...base} />
      </Boundary>,
    );
    fireEvent.click(screen.getByRole("button", { name: "새로고침" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "새로고침에 실패했습니다. 잠시 뒤 다시 시도하세요.",
    );
    expect(screen.queryByText("경계에 걸림")).toBeNull();
    expect(screen.getByRole("button", { name: "새로고침" })).toBeEnabled();
    quiet.mockRestore();
  });

  it("성공하면 오류 문구가 없다", async () => {
    render(<SourceBar {...base} />);
    fireEvent.click(screen.getByRole("button", { name: "새로고침" }));
    await waitFor(() => expect(refresh).toHaveBeenCalled());
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("서류 기준 — 있으면 모달", () => {
    render(
      <SourceBar
        {...base}
        criteria={[
          ["No", "서류"],
          ["1", "발신번호 사전등록 신청서"],
        ]}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "서류 기준" }));
    expect(screen.getByText("발신번호 사전등록 신청서")).toBeInTheDocument();
  });

  it("서류 기준 — 없으면 비활성", () => {
    render(<SourceBar {...base} />);
    const btn = screen.getByRole("button", { name: "서류 기준" });
    expect(btn).toBeDisabled();
    expect(btn).toHaveAttribute(
      "title",
      "05. 제출 서류 기준 시트를 찾지 못했습니다",
    );
  });

  it("최신화 버튼은 라벨 다음, 새로고침 앞", () => {
    render(
      <SourceBar
        {...base}
        refresh={{
          canRequest: true,
          active: null,
          history: [],
          loadError: null,
        }}
      />,
    );
    expect(screen.getAllByRole("button").map((b) => b.textContent)).toEqual([
      "현황 최신화",
      "최신화 이력",
      "새로고침",
      "서류 기준",
    ]);
  });

  it("refresh 가 없으면 최신화 버튼이 없다", () => {
    render(<SourceBar {...base} />);
    expect(screen.queryByRole("button", { name: "최신화 이력" })).toBeNull();
  });

  it("두 버튼 모두 헤더 액션 표준 클래스 그대로 (vermilion + cream)", () => {
    const { container } = render(<SourceBar {...base} />);
    for (const name of ["새로고침", "서류 기준"]) {
      const cls = screen.getByRole("button", { name }).className;
      expect(cls).toBe(HEADER_ACTION_CLASS);
      expect(cls).toContain("bg-vermilion");
      expect(cls).toContain("text-cream");
      expect(cls).toContain("disabled:opacity-50");
      expect(cls).not.toContain("border-line ");
    }
    // 검색줄 자리(px-7 pt-3)가 아니라 머리 안에 들어간다.
    const root = container.firstElementChild!;
    expect(root.className).not.toContain("px-7");
    expect(root.className).not.toContain("pt-3");
  });
});

describe("SourceError", () => {
  it("alert 로 문구를", () => {
    render(
      <SourceError message="‘_학교’ 시트에서 ‘대학명’ 열을 찾지 못했습니다." />,
    );
    expect(screen.getByRole("alert")).toHaveTextContent("‘_학교’ 시트에서");
  });
});
