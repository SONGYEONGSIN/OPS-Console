import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ResendMailButton } from "../ResendMailButton";

vi.mock("@/features/backup-requests/mail-actions", () => ({
  sendBackupRequestMail: vi.fn(async () => ({ ok: true, status: "sent" })),
}));

describe("ResendMailButton", () => {
  it("버튼 렌더 + 클릭 시 비활성화 (loading)", async () => {
    render(<ResendMailButton backupRequestId="abc-123" />);
    const btn = screen.getByRole("button", { name: /재발송/ });
    expect(btn).toBeInTheDocument();
    fireEvent.click(btn);
    expect((btn as HTMLButtonElement).disabled).toBe(true);
  });
});
