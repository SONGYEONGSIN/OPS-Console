import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

vi.mock("@/features/mailbox/actions", () => ({
  grantMailboxDelegation: vi.fn(),
  revokeMailboxDelegation: vi.fn(),
}));
vi.mock("@/features/auth/operators", () => ({
  operatorNameByEmail: (e: string) => e,
}));

import { MailboxDelegationPanel } from "../MailboxDelegationPanel";

describe("MailboxDelegationPanel", () => {
  it("트리거 버튼 문구는 '메일함 위임'이다", () => {
    render(<MailboxDelegationPanel delegations={[]} candidates={[]} />);
    expect(
      screen.getByRole("button", { name: "메일함 위임" }),
    ).toBeInTheDocument();
  });

  it("버튼 클릭 시 위임 관리 모달이 열린다", () => {
    render(<MailboxDelegationPanel delegations={[]} candidates={[]} />);
    fireEvent.click(screen.getByRole("button", { name: "메일함 위임" }));
    expect(screen.getByText("메일함 위임 관리")).toBeInTheDocument();
  });
});
