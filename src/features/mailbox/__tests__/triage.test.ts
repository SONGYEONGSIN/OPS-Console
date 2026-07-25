import { describe, it, expect } from "vitest";
import type { MailboxEntry } from "../queries";
import type { MailboxMessage, MailboxDraft } from "../schemas";
import {
  isReplied,
  isUnread,
  waitingDays,
  isReceivedToday,
  matchesSearch,
  filterScope,
  countScopes,
} from "../triage";

// KST 2026-07-25 10:00
const NOW = new Date("2026-07-25T10:00:00+09:00").getTime();

function msg(over: Partial<MailboxMessage> = {}): MailboxMessage {
  return {
    id: "00000000-0000-0000-0000-000000000001",
    owner_email: "me@x.com",
    graph_message_id: "g1",
    from_name: "김민수",
    from_email: "kim@ex.com",
    subject: "견적 문의",
    body_preview: "안녕하세요 견적 부탁드립니다",
    body: null,
    received_at: "2026-07-25T09:00:00+09:00",
    is_read: false,
    draft_skipped: false,
    created_at: "2026-07-25T09:00:00+09:00",
    ...over,
  };
}

function entry(
  over: Partial<MailboxMessage> = {},
  draftStatus?: MailboxDraft["status"],
): MailboxEntry {
  return {
    message: msg(over),
    latestDraft: draftStatus
      ? {
          id: "00000000-0000-0000-0000-0000000000d1",
          message_id: "00000000-0000-0000-0000-000000000001",
          draft_body: "초안",
          model_used: "claude",
          status: draftStatus,
          sent_at: null,
          sent_by_email: null,
          created_at: "2026-07-25T09:30:00+09:00",
        }
      : null,
  };
}

describe("mailbox/triage", () => {
  describe("isReplied", () => {
    it("최신 draft가 sent/dry_run이면 회신완료", () => {
      expect(isReplied(entry({}, "sent"))).toBe(true);
      expect(isReplied(entry({}, "dry_run"))).toBe(true);
    });
    it("draft 없음/미발송(draft·discarded)이면 미회신", () => {
      expect(isReplied(entry({}))).toBe(false);
      expect(isReplied(entry({}, "draft"))).toBe(false);
      expect(isReplied(entry({}, "discarded"))).toBe(false);
    });
  });

  describe("isUnread", () => {
    it("is_read=false면 안읽음", () => {
      expect(isUnread(entry({ is_read: false }))).toBe(true);
      expect(isUnread(entry({ is_read: true }))).toBe(false);
    });
  });

  describe("waitingDays", () => {
    it("received_at 경과 일수(floor)", () => {
      expect(waitingDays(entry({ received_at: "2026-07-22T09:00:00+09:00" }), NOW)).toBe(3);
    });
    it("미래/없음이면 0", () => {
      expect(waitingDays(entry({ received_at: "2026-07-26T09:00:00+09:00" }), NOW)).toBe(0);
      expect(waitingDays(entry({ received_at: null }), NOW)).toBe(0);
    });
  });

  describe("isReceivedToday (KST)", () => {
    it("같은 KST 날짜면 오늘", () => {
      expect(isReceivedToday(entry({ received_at: "2026-07-25T00:30:00+09:00" }), NOW)).toBe(true);
    });
    it("전날이면 오늘 아님", () => {
      expect(isReceivedToday(entry({ received_at: "2026-07-24T23:00:00+09:00" }), NOW)).toBe(false);
    });
  });

  describe("matchesSearch", () => {
    it("보낸이/제목/미리보기 부분일치(대소문자 무시)", () => {
      expect(matchesSearch(entry({ subject: "견적 문의" }), "견적")).toBe(true);
      expect(matchesSearch(entry({ from_email: "KIM@ex.com" }), "kim")).toBe(true);
      expect(matchesSearch(entry({}), "없는키워드")).toBe(false);
    });
    it("빈 검색어면 전부 통과", () => {
      expect(matchesSearch(entry({}), "  ")).toBe(true);
    });
  });

  describe("filterScope / countScopes", () => {
    // 4건: [미회신·오늘·안읽음], [회신완료·오늘·읽음], [미회신·전날·안읽음], [미회신·전날·읽음]
    const entries: MailboxEntry[] = [
      entry({ received_at: "2026-07-25T08:00:00+09:00", is_read: false }),
      entry({ received_at: "2026-07-25T07:00:00+09:00", is_read: true }, "sent"),
      entry({ received_at: "2026-07-23T08:00:00+09:00", is_read: false }),
      entry({ received_at: "2026-07-22T08:00:00+09:00", is_read: true }),
    ];

    it("scope별 필터", () => {
      expect(filterScope(entries, "all", NOW)).toHaveLength(4);
      expect(filterScope(entries, "unreplied", NOW)).toHaveLength(3);
      expect(filterScope(entries, "today", NOW)).toHaveLength(2);
      expect(filterScope(entries, "unread", NOW)).toHaveLength(2);
    });

    it("countScopes 집계", () => {
      expect(countScopes(entries, NOW)).toEqual({
        all: 4,
        unreplied: 3,
        today: 2,
        unread: 2,
      });
    });
  });
});
