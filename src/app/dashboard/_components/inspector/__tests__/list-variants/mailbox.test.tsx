import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import type { ListRow } from "../../../patterns/ListPattern";
import { MailboxView } from "../../list-variants/mailbox/View";
import { MailboxTable } from "../../list-variants/mailbox/Table";

const baseRow: ListRow = {
  id: "msg-001",
  name: "데이터 추출 요청 회신 문의",
  status: "active",
  owner: "me@ops.example.com",
  mailId: "AAMkAGgraph-id",
  mailOwnerEmail: "me@ops.example.com",
  mailFromName: "김담당",
  mailFromEmail: "kim@univ.example.com",
  mailSubject: "데이터 추출 요청 회신 문의",
  mailBody: "안녕하세요, 지난번 요청드린 데이터 추출 건 진행 상황 문의드립니다.",
  mailReceivedAt: "2026-06-22T01:30:00.000Z",
  mailIsRead: false,
  mailHasDraft: true,
  mailDraftBody: "안녕하세요, 요청하신 데이터는 금주 내 전달드리겠습니다.",
  mailDraftStatus: "draft",
};

describe("MailboxView", () => {
  it("메일 헤더 — 보낸이/주소/제목 표시", () => {
    render(<MailboxView row={baseRow} />);
    expect(screen.getByText("김담당")).toBeInTheDocument();
    expect(screen.getByText("kim@univ.example.com")).toBeInTheDocument();
    expect(screen.getByText("데이터 추출 요청 회신 문의")).toBeInTheDocument();
  });

  it("본문 — mailBody 표시", () => {
    render(<MailboxView row={baseRow} />);
    expect(
      screen.getByText(
        "안녕하세요, 지난번 요청드린 데이터 추출 건 진행 상황 문의드립니다.",
      ),
    ).toBeInTheDocument();
  });

  it("AI 초안 — textarea 초기값이 mailDraftBody", () => {
    render(<MailboxView row={baseRow} />);
    const textarea = screen.getByPlaceholderText(/회신 본문/);
    expect(textarea).toHaveValue(
      "안녕하세요, 요청하신 데이터는 금주 내 전달드리겠습니다.",
    );
  });

  it("발송 — onMailReply를 편집된 본문으로 호출", async () => {
    const onMailReply = vi.fn().mockResolvedValue({ ok: true });
    render(<MailboxView row={baseRow} onMailReply={onMailReply} />);
    fireEvent.click(screen.getByRole("button", { name: "발송" }));
    await waitFor(() =>
      expect(onMailReply).toHaveBeenCalledWith(
        "msg-001",
        "안녕하세요, 요청하신 데이터는 금주 내 전달드리겠습니다.",
      ),
    );
  });

  it("폐기 — textarea 비움", () => {
    render(<MailboxView row={baseRow} />);
    fireEvent.click(screen.getByRole("button", { name: "폐기" }));
    expect(screen.getByPlaceholderText(/회신 본문/)).toHaveValue("");
  });

  it("다시 생성 — Phase 1 비활성(disabled)", () => {
    render(<MailboxView row={baseRow} />);
    expect(screen.getByRole("button", { name: "다시 생성" })).toBeDisabled();
  });

  it("이미 발송된 메일 — 편집 영역 대신 안내 표시", () => {
    render(<MailboxView row={{ ...baseRow, mailDraftStatus: "sent" }} />);
    expect(screen.getByText(/이미 발송된 메일/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "발송" })).toBeNull();
  });
});

describe("MailboxTable", () => {
  it("열 헤더 — 상태/발신자/제목/초안/수신", () => {
    render(
      <MailboxTable rows={[baseRow]} selectedId={null} onSelect={vi.fn()} />,
    );
    expect(screen.getByText("상태")).toBeInTheDocument();
    expect(screen.getByText("발신자")).toBeInTheDocument();
    expect(screen.getByText("제목")).toBeInTheDocument();
    expect(screen.getByText("초안")).toBeInTheDocument();
    expect(screen.getByText("수신")).toBeInTheDocument();
  });

  it("미열람 — ● 표시", () => {
    render(
      <MailboxTable rows={[baseRow]} selectedId={null} onSelect={vi.fn()} />,
    );
    expect(screen.getByText("●")).toBeInTheDocument();
  });

  it("열람 — ○ 표시", () => {
    render(
      <MailboxTable
        rows={[{ ...baseRow, mailIsRead: true }]}
        selectedId={null}
        onSelect={vi.fn()}
      />,
    );
    expect(screen.getByText("○")).toBeInTheDocument();
  });

  it("초안 있음 — 배지 노출", () => {
    render(
      <MailboxTable rows={[baseRow]} selectedId={null} onSelect={vi.fn()} />,
    );
    expect(screen.getByText("✎ 초안")).toBeInTheDocument();
  });

  it("발송됨 — '발송됨' 배지", () => {
    render(
      <MailboxTable
        rows={[{ ...baseRow, mailDraftStatus: "sent" }]}
        selectedId={null}
        onSelect={vi.fn()}
      />,
    );
    expect(screen.getByText("발송됨")).toBeInTheDocument();
  });

  it("행 클릭 — onSelect 호출", () => {
    const onSelect = vi.fn();
    render(
      <MailboxTable rows={[baseRow]} selectedId={null} onSelect={onSelect} />,
    );
    fireEvent.click(screen.getByText("데이터 추출 요청 회신 문의"));
    expect(onSelect).toHaveBeenCalledWith(baseRow);
  });

  it("빈 목록 — 안내 표시", () => {
    render(<MailboxTable rows={[]} selectedId={null} onSelect={vi.fn()} />);
    expect(screen.getByText("수신 메일 없음")).toBeInTheDocument();
  });
});
