import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

// 서버 액션 mock — 모달 open 시 호출되는 fetchReminderGroup를 차단(server-only import 회피).
vi.mock("@/features/receivables/mail-actions", () => ({
  fetchReminderGroup: vi.fn(async () => ({
    thresholdDays: 10,
    sheetAvailable: true,
    group: null,
  })),
  sendReminderEmails: vi.fn(),
}));

import { SendReceivablesMailButton } from "../SendReceivablesMailButton";

describe("SendReceivablesMailButton", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("모달이 document.body로 portal되어 렌더 (transform 조상에 갇히지 않음)", () => {
    render(
      <SendReceivablesMailButton
        email="manager@school.ac.kr"
        customerName="○○대학교"
        dryRun
      />,
    );
    fireEvent.click(screen.getByTestId("inspector-send-mail"));
    const dialog = screen.getByRole("dialog");
    // portal 대상이 document.body이면 dialog의 부모가 body다.
    // (portal이 아니면 RTL 컨테이너 div 안에 중첩되어 parentElement !== body)
    expect(dialog.parentElement).toBe(document.body);
  });
});
