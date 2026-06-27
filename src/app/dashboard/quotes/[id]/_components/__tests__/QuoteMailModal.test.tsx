import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

import { QuoteMailModal } from "../QuoteMailModal";

describe("QuoteMailModal", () => {
  it("입력한 외부 이메일로 발송 콜백", () => {
    const onSend = vi.fn();
    render(
      <QuoteMailModal
        recipientName="건국대학교"
        busy={false}
        onClose={() => {}}
        onSend={onSend}
      />,
    );
    fireEvent.change(screen.getByPlaceholderText(/example.com/), {
      target: { value: "school@univ.ac.kr, staff@univ.ac.kr" },
    });
    fireEvent.click(screen.getByRole("button", { name: /^발송/ }));
    expect(onSend).toHaveBeenCalledWith([
      "school@univ.ac.kr",
      "staff@univ.ac.kr",
    ]);
  });

  it("이메일 없으면 발송 비활성, 비이메일은 제외 경고", () => {
    render(
      <QuoteMailModal
        recipientName=""
        busy={false}
        onClose={() => {}}
        onSend={vi.fn()}
      />,
    );
    expect(screen.getByRole("button", { name: /^발송/ })).toBeDisabled();
    fireEvent.change(screen.getByPlaceholderText(/example.com/), {
      target: { value: "이름만, ok@x.com" },
    });
    const warn = screen.getByText(/제외됨/);
    expect(warn.textContent).toContain("이름만");
    expect(screen.getByRole("button", { name: /^발송/ })).not.toBeDisabled();
  });
});
