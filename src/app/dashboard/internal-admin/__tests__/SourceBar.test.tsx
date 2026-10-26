import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { Component, type ReactNode } from "react";

const refresh = vi.fn();
vi.mock("@/features/sms-sender/actions", () => ({
  refreshSmsSenderCache: () => refresh(),
}));

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
  offRuleFiles: [] as string[],
  unmatchedPdfs: [] as string[],
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

  it("원천 경고는 있을 때만", () => {
    const { rerender } = render(<SourceBar {...base} />);
    expect(screen.queryByText(/규칙 밖 파일/)).toBeNull();
    expect(screen.queryByText(/이름 미대조 PDF/)).toBeNull();
    rerender(
      <SourceBar {...base} offRuleFiles={["a.txt"]} unmatchedPdfs={["x.pdf", "y.pdf"]} />,
    );
    expect(screen.getByText("규칙 밖 파일 1개")).toBeInTheDocument();
    expect(screen.getByText("이름 미대조 PDF 2개")).toBeInTheDocument();
  });

  it("버튼은 버튼 호버 표준", () => {
    render(<SourceBar {...base} />);
    const cls = screen.getByRole("button", { name: "새로고침" }).className;
    expect(cls).toContain("hover:bg-ink");
    expect(cls).toContain("hover:text-cream");
    expect(cls).toContain("hover:border-ink");
  });
});

describe("SourceError", () => {
  it("alert 로 문구를", () => {
    render(<SourceError message="‘_학교’ 시트에서 ‘대학명’ 열을 찾지 못했습니다." />);
    expect(screen.getByRole("alert")).toHaveTextContent("‘_학교’ 시트에서");
  });
});
