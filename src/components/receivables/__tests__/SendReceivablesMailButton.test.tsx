import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

// 서버 액션 mock — 모달 open 시 호출되는 fetchReminderGroup를 차단(server-only import 회피).
const fetchReminderGroupMock = vi.fn();
const sendReminderEmailsMock = vi.fn();
vi.mock("@/features/receivables/mail-actions", () => ({
  fetchReminderGroup: (...args: unknown[]) => fetchReminderGroupMock(...args),
  sendReminderEmails: (...args: unknown[]) => sendReminderEmailsMock(...args),
}));

import { SendReceivablesMailButton } from "../SendReceivablesMailButton";

const item = (customerName: string, amount: number, daysOverdue = 25) => ({
  customerName,
  invoiceDate: "2026-05-07",
  description: "",
  daysOverdue,
  amount,
  operatorLabel: "한효진",
});

/** 운영자 1명 · 청구건 1건 */
const ONE_GROUP = {
  thresholdDays: 10,
  sheetAvailable: true,
  blocked: [],
  groups: [
    {
      sender: { name: "한효진", email: "hhj@jinhakapply.com" },
      recipient: { email: "manager@school.ac.kr" },
      items: [item("○○대학교", 90_000)],
      totalAmount: 90_000,
    },
  ],
};

/** 운영자 2명 → 2통 분리 발송 */
const TWO_GROUPS = {
  thresholdDays: 10,
  sheetAvailable: true,
  blocked: [],
  groups: [
    {
      sender: { name: "한효진", email: "hhj@jinhakapply.com" },
      recipient: { email: "manager@school.ac.kr" },
      items: [item("○○대학교", 90_000)],
      totalAmount: 90_000,
    },
    {
      sender: { name: "송영신", email: "ys1114@jinhakapply.com" },
      recipient: { email: "manager@school.ac.kr" },
      items: [item("△△대학교", 50_000)],
      totalAmount: 50_000,
    },
  ],
};

const BLOCKED_ONLY = {
  thresholdDays: 10,
  sheetAvailable: true,
  groups: [],
  blocked: [
    {
      rowIndex: 3,
      customerName: "C학교",
      recipientEmail: "manager@school.ac.kr",
      reason: "operator_email_not_mapped" as const,
    },
  ],
};

function renderButton(dryRun = true) {
  return render(
    <SendReceivablesMailButton
      email="manager@school.ac.kr"
      customerName="○○대학교"
      dryRun={dryRun}
    />,
  );
}

describe("SendReceivablesMailButton", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // 모달 portal 대상 — 실제 앱에서는 DashboardShell이 렌더한다.
    if (!document.getElementById("ops-modal-root")) {
      const root = document.createElement("div");
      root.id = "ops-modal-root";
      document.body.appendChild(root);
    }
    fetchReminderGroupMock.mockResolvedValue({
      thresholdDays: 10,
      sheetAvailable: true,
      groups: [],
      blocked: [],
    });
    sendReminderEmailsMock.mockResolvedValue({
      ok: true,
      sentCount: 0,
      failedCount: 0,
      dryRunCount: 1,
      blockedCount: 0,
      results: [],
    });
  });

  it("발송 클릭 후 모달이 닫히지 않고 결과(send-result)를 표시", async () => {
    fetchReminderGroupMock.mockResolvedValue(ONE_GROUP);
    renderButton();
    fireEvent.click(screen.getByTestId("inspector-send-mail"));
    const confirm = await screen.findByTestId("confirm-send");
    fireEvent.click(confirm);
    const result = await screen.findByTestId("send-result");
    expect(result).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeNull();
  });

  it("발송 시 서버 액션에 recipientEmail/scope/dryRun 만 전달 (발신자 미전달)", async () => {
    fetchReminderGroupMock.mockResolvedValue(ONE_GROUP);
    renderButton();
    fireEvent.click(screen.getByTestId("inspector-send-mail"));
    fireEvent.click(await screen.findByTestId("confirm-send"));
    await screen.findByTestId("send-result");

    expect(sendReminderEmailsMock).toHaveBeenCalledTimes(1);
    const arg = sendReminderEmailsMock.mock.calls[0][0];
    expect(arg).toEqual({
      recipientEmail: "manager@school.ac.kr",
      scope: "bundle",
      customerName: "○○대학교",
      dryRun: true,
    });
    expect(arg).not.toHaveProperty("groups");
  });

  it("운영자 2명 → 운영자별 섹션 + 'N통' 안내 표시", async () => {
    fetchReminderGroupMock.mockResolvedValue(TWO_GROUPS);
    renderButton();
    fireEvent.click(screen.getByTestId("inspector-send-mail"));

    const preview = await screen.findByTestId("preview");
    expect(preview).toBeInTheDocument();
    expect(screen.getAllByTestId("operator-group")).toHaveLength(2);
    expect(screen.getByTestId("multi-sender-notice").textContent).toContain(
      "2통",
    );
    // 각 그룹의 발신 메일박스가 노출된다
    expect(preview.textContent).toContain("hhj@jinhakapply.com");
    expect(preview.textContent).toContain("ys1114@jinhakapply.com");
  });

  it("blocked 존재 시 제외 사유 배너 노출", async () => {
    fetchReminderGroupMock.mockResolvedValue({
      ...TWO_GROUPS,
      blocked: BLOCKED_ONLY.blocked,
    });
    renderButton();
    fireEvent.click(screen.getByTestId("inspector-send-mail"));

    const banner = await screen.findByTestId("blocked-banner");
    expect(banner.textContent).toContain("C학교");
    expect(banner.textContent).toMatch(/운영자|매핑/);
  });

  it("전건 blocked → 발송 버튼 미노출 + 안내", async () => {
    fetchReminderGroupMock.mockResolvedValue(BLOCKED_ONLY);
    renderButton();
    fireEvent.click(screen.getByTestId("inspector-send-mail"));

    await screen.findByTestId("blocked-banner");
    expect(screen.queryByTestId("confirm-send")).toBeNull();
    expect(sendReminderEmailsMock).not.toHaveBeenCalled();
  });

  it("청구건이 없으면 안내 메시지", async () => {
    renderButton(); // 기본 mock: groups=[], blocked=[]
    fireEvent.click(screen.getByTestId("inspector-send-mail"));
    const err = await screen.findByTestId("send-error");
    expect(err.textContent).toContain("manager@school.ac.kr");
  });

  it("단건 scope 선택 시 scope='single' 로 발송", async () => {
    fetchReminderGroupMock.mockResolvedValue(TWO_GROUPS);
    renderButton();
    fireEvent.click(screen.getByTestId("inspector-send-mail"));

    fireEvent.click(await screen.findByTestId("scope-single"));
    fireEvent.click(await screen.findByTestId("confirm-send"));
    await screen.findByTestId("send-result");

    const arg = sendReminderEmailsMock.mock.calls[0][0];
    expect(arg.scope).toBe("single");
    expect(arg.customerName).toBe("○○대학교");
  });

  it("모달이 #ops-modal-root로 portal되어 렌더 (transform 조상에 갇히지 않음)", () => {
    renderButton();
    fireEvent.click(screen.getByTestId("inspector-send-mail"));
    const dialog = screen.getByRole("dialog");
    expect(dialog.closest("#ops-modal-root")).not.toBeNull();
  });

  it("모달 패널은 불투명 배경(bg-paper) — 미정의 토큰으로 투명해지지 않음", () => {
    renderButton();
    fireEvent.click(screen.getByTestId("inspector-send-mail"));
    const panel = screen.getByRole("dialog");
    expect(panel.className).toContain("bg-paper");
    expect(panel.className).not.toContain("bg-washi-base");
  });
});
