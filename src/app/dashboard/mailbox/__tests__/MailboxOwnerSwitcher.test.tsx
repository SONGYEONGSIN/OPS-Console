import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

const push = vi.fn();
let search = "";
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
  usePathname: () => "/dashboard/mailbox",
  useSearchParams: () => new URLSearchParams(search),
}));

import { MailboxOwnerSwitcher } from "../MailboxOwnerSwitcher";

const OPTIONS = [
  { email: "me@jinhak.com", label: "내 메일함" },
  { email: "boss@jinhak.com", label: "보스 메일함" },
];

beforeEach(() => {
  push.mockClear();
  search = "";
});

describe("MailboxOwnerSwitcher", () => {
  it("옵션이 1개 이하면 미노출", () => {
    const { container } = render(
      <MailboxOwnerSwitcher options={[OPTIONS[0]]} current="me@jinhak.com" />,
    );
    expect(container.querySelector("select")).toBeNull();
  });

  it("메일함 전환 → ?owner= 갱신 + page 초기화", () => {
    search = "page=3";
    render(<MailboxOwnerSwitcher options={OPTIONS} current="me@jinhak.com" />);
    fireEvent.change(screen.getByRole("combobox"), {
      target: { value: "boss@jinhak.com" },
    });
    expect(push).toHaveBeenCalledWith(
      "/dashboard/mailbox?owner=boss%40jinhak.com",
    );
  });
});
