import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MailboxTable } from "../Table";
import type { ListRow } from "../../../../patterns/ListPattern";

// KST 2026-07-25 10:00
const NOW = new Date("2026-07-25T10:00:00+09:00").getTime();

function row(over: Partial<ListRow> = {}): ListRow {
  return {
    id: "m1",
    title: "메일",
    mailFromName: "김민수",
    mailSubject: "견적 문의",
    mailReceivedAt: "2026-07-25T09:00:00+09:00",
    mailIsRead: false,
    mailHasDraft: false,
    mailDraftStatus: null,
    ...over,
  } as ListRow;
}

describe("MailboxTable — 회신상태·경과일", () => {
  it("미회신 + 3일 경과 표시 (오래된 미발송 메일)", () => {
    render(
      <MailboxTable
        rows={[
          row({
            id: "old",
            mailReceivedAt: "2026-07-22T09:00:00+09:00",
            mailDraftStatus: null,
          }),
        ]}
        selectedId={null}
        onSelect={vi.fn()}
        nowMs={NOW}
      />,
    );
    expect(screen.getByText("미회신")).toBeInTheDocument();
    expect(screen.getByText(/3일 경과/)).toBeInTheDocument();
  });

  it("회신완료 표시 (draft status=sent) — 경과일 없음", () => {
    render(
      <MailboxTable
        rows={[
          row({
            id: "done",
            mailReceivedAt: "2026-07-22T09:00:00+09:00",
            mailHasDraft: true,
            mailDraftStatus: "sent",
          }),
        ]}
        selectedId={null}
        onSelect={vi.fn()}
        nowMs={NOW}
      />,
    );
    expect(screen.getByText("회신완료")).toBeInTheDocument();
    expect(screen.queryByText(/경과/)).toBeNull();
  });

  it("안읽음 점(●) 표시", () => {
    render(
      <MailboxTable
        rows={[row({ id: "unread", mailIsRead: false })]}
        selectedId={null}
        onSelect={vi.fn()}
        nowMs={NOW}
      />,
    );
    expect(screen.getByText("●")).toBeInTheDocument();
  });
});
