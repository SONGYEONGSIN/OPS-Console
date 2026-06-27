import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

import { MeetingMailModal } from "../MeetingMailModal";
import { OPERATORS } from "@/features/auth/operators";

const op = OPERATORS[0];

describe("MeetingMailModal", () => {
  it("참석자 이름과 일치하는 운영자를 초기 선택 → 발송 시 그 이메일 전달", () => {
    const onSend = vi.fn();
    render(
      <MeetingMailModal
        attendees={[op.name]}
        busy={false}
        onClose={() => {}}
        onSend={onSend}
      />,
    );
    // 발송 버튼에 선택 수(1) 노출
    const sendBtn = screen.getByRole("button", { name: /발송/ });
    fireEvent.click(sendBtn);
    expect(onSend).toHaveBeenCalledWith([op.email]);
  });

  it("수신자가 없으면 발송 버튼 비활성", () => {
    render(
      <MeetingMailModal
        attendees={[]}
        busy={false}
        onClose={() => {}}
        onSend={vi.fn()}
      />,
    );
    expect(screen.getByRole("button", { name: /발송/ })).toBeDisabled();
  });

  it("직접 입력의 이름(비이메일)은 제외 경고로 표시", () => {
    render(
      <MeetingMailModal
        attendees={[]}
        busy={false}
        onClose={() => {}}
        onSend={vi.fn()}
      />,
    );
    fireEvent.change(screen.getByPlaceholderText(/example.com/), {
      target: { value: "강감찬, ok@x.com" },
    });
    const warning = screen.getByText(/제외됨/);
    expect(warning).toBeInTheDocument();
    expect(warning.textContent).toContain("강감찬");
  });
});
