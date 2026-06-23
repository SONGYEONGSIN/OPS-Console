import { describe, it, expect } from "vitest";
import { mailboxEntryToListRow } from "../_row-mapper";
import type { MailboxEntry } from "@/features/mailbox/queries";
import type { MailboxMessage, MailboxDraft } from "@/features/mailbox/schemas";

const message: MailboxMessage = {
  id: crypto.randomUUID(),
  owner_email: "me@x.com",
  graph_message_id: "AAMkAGgraph123",
  from_name: "홍길동",
  from_email: "hong@univ.ac.kr",
  subject: "원서 결제 문의",
  body_preview: "결제가 안 됩니다",
  body: "결제가 안 됩니다. 확인 부탁드립니다.",
  received_at: "2026-06-22T01:00:00Z",
  is_read: false,
  draft_skipped: false,
  created_at: "2026-06-22T01:00:01Z",
};

const draft: MailboxDraft = {
  id: crypto.randomUUID(),
  message_id: message.id,
  draft_body: "안녕하세요, 확인해보겠습니다.",
  model_used: "qwen2.5",
  status: "draft",
  sent_at: null,
  sent_by_email: null,
  created_at: "2026-06-22T01:00:05Z",
};

describe("mailboxEntryToListRow", () => {
  it("초안 없는 메일: mail* 필드 매핑 + mailHasDraft=false", () => {
    const entry: MailboxEntry = { message, latestDraft: null };
    const row = mailboxEntryToListRow(entry);
    expect(row.id).toBe(message.id);
    expect(row.name).toBe("원서 결제 문의");
    expect(row.status).toBe("active");
    expect(row.owner).toBe("me@x.com");
    expect(row.mailId).toBe("AAMkAGgraph123");
    expect(row.mailOwnerEmail).toBe("me@x.com");
    expect(row.mailFromName).toBe("홍길동");
    expect(row.mailFromEmail).toBe("hong@univ.ac.kr");
    expect(row.mailSubject).toBe("원서 결제 문의");
    expect(row.mailBody).toBe("결제가 안 됩니다. 확인 부탁드립니다.");
    expect(row.mailReceivedAt).toBe("2026-06-22T01:00:00Z");
    expect(row.mailIsRead).toBe(false);
    expect(row.mailHasDraft).toBe(false);
    expect(row.mailDraftBody).toBeNull();
    expect(row.mailDraftStatus).toBeNull();
  });

  it("제목 null 시 '(제목 없음)' 폴백", () => {
    const entry: MailboxEntry = {
      message: { ...message, subject: null },
      latestDraft: null,
    };
    expect(mailboxEntryToListRow(entry).name).toBe("(제목 없음)");
  });

  it("본문의 추적 비콘/cid 잔재는 cleanMailBody로 정제해 매핑한다", () => {
    const entry: MailboxEntry = {
      message: {
        ...message,
        body: "[http://webmail.kcue.or.kr/mail/dsn/3540352]\r\n\r\n안녕하세요.\r\n\r\n[cid:img.png]",
      },
      latestDraft: null,
    };
    expect(mailboxEntryToListRow(entry).mailBody).toBe("안녕하세요.");
  });

  it("초안 있는 메일: mailHasDraft=true + draft 본문/상태 매핑", () => {
    const entry: MailboxEntry = { message, latestDraft: draft };
    const row = mailboxEntryToListRow(entry);
    expect(row.mailHasDraft).toBe(true);
    expect(row.mailDraftBody).toBe("안녕하세요, 확인해보겠습니다.");
    expect(row.mailDraftStatus).toBe("draft");
  });
});
