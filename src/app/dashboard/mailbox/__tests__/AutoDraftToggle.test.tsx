import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { AutoDraftToggle } from "../AutoDraftToggle";
import { setAutoDraftEnabled } from "@/features/mailbox/actions";

vi.mock("@/features/mailbox/actions", () => ({
  setAutoDraftEnabled: vi.fn(),
}));

const mockSet = vi.mocked(setAutoDraftEnabled);

describe("AutoDraftToggle", () => {
  beforeEach(() => {
    mockSet.mockReset();
  });

  it("initialEnabled=true 시 'ON' 라벨 + aria-pressed=true", () => {
    render(<AutoDraftToggle ownerEmail="me@x.com" initialEnabled />);
    const btn = screen.getByRole("button");
    expect(btn).toHaveTextContent("자동 초안 ON");
    expect(btn).toHaveAttribute("aria-pressed", "true");
  });

  it("클릭 시 OFF로 토글 + setAutoDraftEnabled(me, false) 호출", async () => {
    mockSet.mockResolvedValue({ ok: true });
    render(<AutoDraftToggle ownerEmail="me@x.com" initialEnabled />);
    fireEvent.click(screen.getByRole("button"));
    expect(screen.getByRole("button")).toHaveTextContent("자동 초안 OFF");
    await waitFor(() =>
      expect(mockSet).toHaveBeenCalledWith("me@x.com", false),
    );
  });

  it("서버 실패 시 이전 상태로 롤백", async () => {
    mockSet.mockResolvedValue({ ok: false, error: "권한 없음" });
    render(<AutoDraftToggle ownerEmail="me@x.com" initialEnabled={false} />);
    const alertSpy = vi.spyOn(window, "alert").mockImplementation(() => {});
    fireEvent.click(screen.getByRole("button"));
    expect(screen.getByRole("button")).toHaveTextContent("자동 초안 ON");
    await waitFor(() =>
      expect(screen.getByRole("button")).toHaveTextContent("자동 초안 OFF"),
    );
    alertSpy.mockRestore();
  });
});
