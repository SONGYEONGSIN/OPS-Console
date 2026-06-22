import { describe, it, expect } from "vitest";
import {
  mailboxMessageSchema,
  mailboxDraftSchema,
  sendReplySchema,
  setAutoDraftSchema,
} from "../schemas";

const validMessage = {
  id: "11111111-1111-4111-8111-111111111111",
  owner_email: "op@x.com",
  graph_message_id: "AAMkAD...",
  from_name: "김민수",
  from_email: "kim@univ.ac.kr",
  subject: "견적 문의",
  body_preview: "안녕하세요",
  body: "안녕하세요. 견적 문의드립니다.",
  received_at: "2026-06-22T00:12:00+00:00",
  is_read: false,
  draft_skipped: false,
  created_at: "2026-06-22T00:12:30+00:00",
};

describe("mailboxMessageSchema", () => {
  it("유효 메시지 통과", () => {
    expect(mailboxMessageSchema.safeParse(validMessage).success).toBe(true);
  });
  it("owner_email 누락 시 fail", () => {
    expect(
      mailboxMessageSchema.safeParse({ ...validMessage, owner_email: "" })
        .success,
    ).toBe(false);
  });
  it("nullable 필드(from_name/subject) null 허용", () => {
    expect(
      mailboxMessageSchema.safeParse({
        ...validMessage,
        from_name: null,
        subject: null,
      }).success,
    ).toBe(true);
  });
});

describe("sendReplySchema", () => {
  it("messageId(uuid) + editedBody(min 1) 통과", () => {
    const r = sendReplySchema.safeParse({
      messageId: "11111111-1111-4111-8111-111111111111",
      editedBody: "회신드립니다.",
    });
    expect(r.success).toBe(true);
  });
  it("빈 본문 거부", () => {
    const r = sendReplySchema.safeParse({
      messageId: "11111111-1111-4111-8111-111111111111",
      editedBody: "",
    });
    expect(r.success).toBe(false);
  });
});

describe("setAutoDraftSchema", () => {
  it("ownerEmail + enabled:boolean 통과", () => {
    expect(
      setAutoDraftSchema.safeParse({ ownerEmail: "op@x.com", enabled: false })
        .success,
    ).toBe(true);
  });
});
