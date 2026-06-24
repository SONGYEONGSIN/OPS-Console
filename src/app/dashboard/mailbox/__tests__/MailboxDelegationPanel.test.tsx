import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

const { grantMock } = vi.hoisted(() => ({
  grantMock: vi.fn(async () => ({ ok: true })),
}));

vi.mock("@/features/mailbox/actions", () => ({
  grantMailboxDelegation: grantMock,
  revokeMailboxDelegation: vi.fn(),
}));
vi.mock("@/features/auth/operators", () => ({
  operatorNameByEmail: (e: string) => e,
}));

import { MailboxDelegationPanel } from "../MailboxDelegationPanel";

const candidates = [{ email: "b@x.com", name: "B" }];

beforeEach(() => grantMock.mockClear());

describe("MailboxDelegationPanel", () => {
  it("트리거 버튼 문구는 '메일함 위임'이다", () => {
    render(<MailboxDelegationPanel delegations={[]} candidates={[]} />);
    expect(
      screen.getByRole("button", { name: "메일함 위임" }),
    ).toBeInTheDocument();
  });

  it("버튼 클릭 시 종료일 입력이 있는 모달이 열린다 (무기한 옵션 없음)", () => {
    render(<MailboxDelegationPanel delegations={[]} candidates={candidates} />);
    fireEvent.click(screen.getByRole("button", { name: "메일함 위임" }));
    expect(screen.getByText("메일함 위임 관리")).toBeInTheDocument();
    expect(screen.getByLabelText("위임 종료일")).toBeInTheDocument();
    expect(screen.queryByText("무기한")).not.toBeInTheDocument();
  });

  it("종료일 선택 후 위임 → grant(email, 날짜) 호출", () => {
    render(<MailboxDelegationPanel delegations={[]} candidates={candidates} />);
    fireEvent.click(screen.getByRole("button", { name: "메일함 위임" }));
    fireEvent.change(screen.getByLabelText("위임할 운영자 선택"), {
      target: { value: "b@x.com" },
    });
    fireEvent.change(screen.getByLabelText("위임 종료일"), {
      target: { value: "2099-07-24" },
    });
    fireEvent.click(screen.getByRole("button", { name: "위임" }));
    expect(grantMock).toHaveBeenCalledWith("b@x.com", "2099-07-24");
  });

  it("종료일 없이는 위임 버튼이 비활성", () => {
    render(<MailboxDelegationPanel delegations={[]} candidates={candidates} />);
    fireEvent.click(screen.getByRole("button", { name: "메일함 위임" }));
    fireEvent.change(screen.getByLabelText("위임할 운영자 선택"), {
      target: { value: "b@x.com" },
    });
    expect(screen.getByRole("button", { name: "위임" })).toBeDisabled();
  });

  it("위임 목록에 만료 라벨(날짜까지)을 표시한다", () => {
    render(
      <MailboxDelegationPanel
        candidates={[]}
        delegations={[
          {
            id: "11111111-1111-1111-1111-111111111111",
            owner_email: "me@x.com",
            grantee_email: "b@x.com",
            granted_at: "2026-06-24T00:00:00Z",
            revoked_at: null,
            expires_at: "2026-07-24T14:59:59.999Z",
          },
        ]}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "메일함 위임" }));
    expect(screen.getByText("2026-07-24까지")).toBeInTheDocument();
  });
});
