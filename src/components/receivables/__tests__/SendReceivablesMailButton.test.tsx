import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

// 서버 액션 mock — 모달 open 시 호출되는 fetchReminderGroup를 차단(server-only import 회피).
const fetchReminderGroupMock = vi.fn();
const sendReminderEmailsMock = vi.fn();
vi.mock("@/features/receivables/mail-actions", () => ({
  fetchReminderGroup: (...args: unknown[]) => fetchReminderGroupMock(...args),
  sendReminderEmails: (...args: unknown[]) => sendReminderEmailsMock(...args),
}));

import { SendReceivablesMailButton } from "../SendReceivablesMailButton";

const GROUP_1 = {
  thresholdDays: 10,
  sheetAvailable: true,
  group: {
    recipient: { email: "manager@school.ac.kr" },
    items: [
      {
        customerName: "○○대학교",
        invoiceDate: "2026-05-07",
        description: "",
        daysOverdue: 25,
        amount: 90000,
        operatorLabel: "한효진",
      },
    ],
    totalAmount: 90000,
  },
};

describe("SendReceivablesMailButton", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fetchReminderGroupMock.mockResolvedValue({
      thresholdDays: 10,
      sheetAvailable: true,
      group: null,
    });
    sendReminderEmailsMock.mockResolvedValue({
      ok: true,
      sentCount: 0,
      failedCount: 0,
      dryRunCount: 1,
      results: [],
    });
  });

  it("발송 클릭 후 모달이 닫히지 않고 결과(send-result)를 표시", async () => {
    fetchReminderGroupMock.mockResolvedValue(GROUP_1);
    render(
      <SendReceivablesMailButton
        email="manager@school.ac.kr"
        customerName="○○대학교"
        dryRun
      />,
    );
    fireEvent.click(screen.getByTestId("inspector-send-mail"));
    // 단건 → 바로 preview, confirm-send 노출
    const confirm = await screen.findByTestId("confirm-send");
    fireEvent.click(confirm);
    // 발송 후 결과가 모달 안에 표시되고 dialog는 유지돼야 한다.
    const result = await screen.findByTestId("send-result");
    expect(result).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeNull();
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

  it("모달 패널은 불투명 배경(bg-cream) — 미정의 토큰으로 투명해지지 않음", () => {
    render(
      <SendReceivablesMailButton
        email="manager@school.ac.kr"
        customerName="○○대학교"
        dryRun
      />,
    );
    fireEvent.click(screen.getByTestId("inspector-send-mail"));
    const panel = screen.getByRole("dialog").firstElementChild;
    expect(panel?.className).toContain("bg-cream");
    // 미정의 토큰 회귀 가드
    expect(panel?.className).not.toContain("bg-washi-base");
  });
});
