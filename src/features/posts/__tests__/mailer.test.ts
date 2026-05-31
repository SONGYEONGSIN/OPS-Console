import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

vi.mock("@/lib/microsoft/sendmail", () => ({
  sendGraphMail: vi.fn(),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(),
}));

import { sendGraphMail } from "@/lib/microsoft/sendmail";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  FEEDBACK_OWNER_EMAIL,
  buildOwnerNotifySubject,
  buildOwnerNotifyBody,
  buildStatusNotifySubject,
  buildStatusNotifyBody,
  sendFeedbackOwnerNotify,
  sendFeedbackStatusNotify,
} from "../mailer";
import type { PostRow } from "../schemas";

const ORIG_ENV = { ...process.env };

const samplePost: PostRow = {
  id: "11111111-1111-1111-1111-111111111111",
  domain: "feedback",
  slug: "FB-007",
  title: "검색창 자동완성 추가 요청",
  body: "현재 메뉴 검색이 정확 일치만 매칭됨. 부분 매칭 추가 필요.",
  author_email: "member@jinhakapply.com",
  author_id: null,
  owner_label: "송영신",
  status: "urgent",
  created_at: "2026-05-25T10:00:00+09:00",
  updated_at: "2026-05-25T10:00:00+09:00",
};

function mockAdminInsert(): ReturnType<typeof vi.fn> {
  const insert = vi.fn().mockResolvedValue({ data: null, error: null });
  const from = vi.fn().mockReturnValue({ insert });
  vi.mocked(createAdminClient).mockReturnValue({
    from,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any);
  return insert;
}

beforeEach(() => {
  vi.resetAllMocks();
});

afterEach(() => {
  process.env = { ...ORIG_ENV };
});

describe("FEEDBACK_OWNER_EMAIL", () => {
  it("송영신 이메일 상수", () => {
    expect(FEEDBACK_OWNER_EMAIL).toBe("ys1114@jinhakapply.com");
  });
});

describe("buildOwnerNotifySubject", () => {
  it("브랜드 prefix + '새 개선요청' + 제목", () => {
    const s = buildOwnerNotifySubject({ title: "검색창 자동완성 추가 요청" });
    expect(s).toBe("[운영부 상황실] 새 개선요청: 검색창 자동완성 추가 요청");
  });
});

describe("buildOwnerNotifyBody", () => {
  it("등록자/제목/본문/링크가 HTML에 포함", () => {
    const html = buildOwnerNotifyBody({
      post: samplePost,
      authorName: "김슬기",
      appUrl: "https://ops.example.com",
    });
    expect(html).toContain("김슬기");
    expect(html).toContain("검색창 자동완성 추가 요청");
    expect(html).toContain("부분 매칭 추가 필요");
    expect(html).toContain("https://ops.example.com/dashboard/feedback");
    expect(html).toContain("FB-007");
    // 브랜드 통일: 푸터는 운영부 상황실, OPS Console 미노출
    expect(html).toContain("운영부 상황실");
    expect(html).not.toContain("OPS Console");
  });

  it("본문(body)이 null이어도 안전", () => {
    const html = buildOwnerNotifyBody({
      post: { ...samplePost, body: null },
      authorName: "김슬기",
      appUrl: "https://ops.example.com",
    });
    expect(html).toContain("김슬기");
    expect(html).not.toContain("null");
  });
});

describe("buildStatusNotifySubject", () => {
  it.each([
    ["urgent", "요청"],
    ["review", "확인"],
    ["active", "처리중"],
    ["approved", "처리완료"],
  ] as const)("status=%s → 라벨 '%s' 포함", (status, label) => {
    const s = buildStatusNotifySubject({ title: "검색창 자동완성", statusTo: status });
    expect(s).toBe(`[운영부 상황실] 개선요청 ${label}: 검색창 자동완성`);
  });
});

describe("buildStatusNotifyBody", () => {
  it("변경 후 상태 라벨 + 변경자 이름 + 링크 포함", () => {
    const html = buildStatusNotifyBody({
      post: samplePost,
      statusTo: "active",
      changerName: "송영신",
      appUrl: "https://ops.example.com",
    });
    expect(html).toContain("처리중");
    expect(html).toContain("송영신");
    expect(html).toContain("검색창 자동완성 추가 요청");
    expect(html).toContain("https://ops.example.com/dashboard/feedback");
  });
});

describe("sendFeedbackOwnerNotify", () => {
  it("dryRun=false: Graph 호출 + 이력 sent 적재", async () => {
    const insert = mockAdminInsert();
    vi.mocked(sendGraphMail).mockResolvedValue({ ok: true, messageId: "msg-1" });

    const r = await sendFeedbackOwnerNotify({
      post: samplePost,
      senderEmail: "member@jinhakapply.com",
      senderOperatorId: "op-uuid-member",
      authorName: "김슬기",
      appUrl: "https://ops.example.com",
      dryRun: false,
    });

    expect(r.status).toBe("sent");
    expect(sendGraphMail).toHaveBeenCalledWith(
      expect.objectContaining({
        senderUserId: "member@jinhakapply.com",
        toEmail: FEEDBACK_OWNER_EMAIL,
        subject: expect.stringContaining("새 개선요청"),
      }),
    );
    expect(insert).toHaveBeenCalledTimes(1);
    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({
        post_id: samplePost.id,
        event_type: "create",
        recipient_email: FEEDBACK_OWNER_EMAIL,
        sender_email: "member@jinhakapply.com",
        status: "sent",
        graph_message_id: "msg-1",
      }),
    );
  });

  it("dryRun=true: Graph 미호출 + 이력 dry_run 적재", async () => {
    const insert = mockAdminInsert();
    vi.mocked(sendGraphMail).mockResolvedValue({ ok: true, messageId: "x" });

    const r = await sendFeedbackOwnerNotify({
      post: samplePost,
      senderEmail: "member@jinhakapply.com",
      senderOperatorId: null,
      authorName: "김슬기",
      appUrl: "https://ops.example.com",
      dryRun: true,
    });

    expect(r.status).toBe("dry_run");
    expect(sendGraphMail).not.toHaveBeenCalled();
    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({
        event_type: "create",
        status: "dry_run",
        graph_message_id: null,
      }),
    );
  });

  it("Graph 실패: 이력 failed + error_message 적재", async () => {
    const insert = mockAdminInsert();
    vi.mocked(sendGraphMail).mockResolvedValue({ ok: false, error: "graph_500: oops" });

    const r = await sendFeedbackOwnerNotify({
      post: samplePost,
      senderEmail: "member@jinhakapply.com",
      senderOperatorId: null,
      authorName: "김슬기",
      appUrl: "https://ops.example.com",
      dryRun: false,
    });

    expect(r.status).toBe("failed");
    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({
        event_type: "create",
        status: "failed",
        error_message: expect.stringContaining("graph_500"),
      }),
    );
  });

  it("발신자=수신자(송영신 본인 등록): skip 반환, Graph/insert 미호출", async () => {
    const insert = mockAdminInsert();
    vi.mocked(sendGraphMail).mockResolvedValue({ ok: true, messageId: "x" });

    const r = await sendFeedbackOwnerNotify({
      post: samplePost,
      senderEmail: FEEDBACK_OWNER_EMAIL,
      senderOperatorId: "op-uuid-owner",
      authorName: "송영신",
      appUrl: "https://ops.example.com",
      dryRun: false,
    });

    expect(r.status).toBe("skipped");
    expect(sendGraphMail).not.toHaveBeenCalled();
    expect(insert).not.toHaveBeenCalled();
  });
});

describe("sendFeedbackStatusNotify", () => {
  it("dryRun=false: 등록자에게 Graph 호출 + 이력 sent", async () => {
    const insert = mockAdminInsert();
    vi.mocked(sendGraphMail).mockResolvedValue({ ok: true, messageId: "msg-2" });

    const r = await sendFeedbackStatusNotify({
      post: { ...samplePost, status: "active" },
      statusTo: "active",
      senderEmail: FEEDBACK_OWNER_EMAIL,
      senderOperatorId: "op-uuid-owner",
      changerName: "송영신",
      appUrl: "https://ops.example.com",
      dryRun: false,
    });

    expect(r.status).toBe("sent");
    expect(sendGraphMail).toHaveBeenCalledWith(
      expect.objectContaining({
        toEmail: samplePost.author_email,
        subject: expect.stringContaining("처리중"),
      }),
    );
    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({
        event_type: "status_change",
        status_to: "active",
        recipient_email: samplePost.author_email,
        status: "sent",
      }),
    );
  });

  it("발신자=등록자(본인이 자기 글 상태 바꿈): skip", async () => {
    const insert = mockAdminInsert();
    vi.mocked(sendGraphMail).mockResolvedValue({ ok: true, messageId: "x" });

    const r = await sendFeedbackStatusNotify({
      post: { ...samplePost, status: "active" },
      statusTo: "active",
      senderEmail: samplePost.author_email,
      senderOperatorId: "op-uuid-author",
      changerName: "본인",
      appUrl: "https://ops.example.com",
      dryRun: false,
    });

    expect(r.status).toBe("skipped");
    expect(sendGraphMail).not.toHaveBeenCalled();
    expect(insert).not.toHaveBeenCalled();
  });
});
