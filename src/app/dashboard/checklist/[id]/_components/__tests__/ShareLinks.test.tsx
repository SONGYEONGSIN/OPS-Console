import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { ShareLinks } from "../ShareLinks";
import { toggleChecklistShare } from "@/features/checklist/actions";
import type { ShareToken } from "@/features/checklist/schemas";

vi.mock("@/features/checklist/actions", () => ({
  toggleChecklistShare: vi.fn(),
}));
const mockToggle = vi.mocked(toggleChecklistShare);

const roundId = "11111111-1111-1111-1111-111111111111";
function tok(kind: "fill" | "report", token: string): ShareToken {
  return {
    id: `t-${kind}`,
    roundId,
    kind,
    department: null,
    token,
    enabled: true,
  };
}

describe("ShareLinks (작성/확인 통합)", () => {
  beforeEach(() => {
    mockToggle.mockReset();
    mockToggle.mockResolvedValue({ ok: true, token: "new-tok" });
  });

  it("토큰 없음 → '작성 공유 링크 생성' + '보고용 링크 생성' 버튼", () => {
    render(<ShareLinks roundId={roundId} tokens={[]} />);
    expect(screen.getByText("작성 공유 링크 생성")).toBeInTheDocument();
    expect(screen.getByText("보고용 링크 생성")).toBeInTheDocument();
  });

  it("작성 링크 생성 클릭 → toggleChecklistShare(roundId,'fill')", async () => {
    render(<ShareLinks roundId={roundId} tokens={[]} />);
    fireEvent.click(screen.getByText("작성 공유 링크 생성"));
    await waitFor(() =>
      expect(mockToggle).toHaveBeenCalledWith(roundId, "fill"),
    );
  });

  it("확인 링크 생성 클릭 → toggleChecklistShare(roundId,'report')", async () => {
    render(<ShareLinks roundId={roundId} tokens={[]} />);
    fireEvent.click(screen.getByText("보고용 링크 생성"));
    await waitFor(() =>
      expect(mockToggle).toHaveBeenCalledWith(roundId, "report"),
    );
  });

  it("발급된 토큰 → 복사/해제 노출, 복사 시 /r/checklist/{token}", () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText },
      configurable: true,
    });
    render(<ShareLinks roundId={roundId} tokens={[tok("fill", "fill-abc")]} />);
    fireEvent.click(screen.getAllByText("복사")[0]);
    expect(writeText).toHaveBeenCalledWith(
      `${window.location.origin}/r/checklist/fill-abc`,
    );
    expect(screen.getAllByText("해제").length).toBeGreaterThan(0);
  });
});
