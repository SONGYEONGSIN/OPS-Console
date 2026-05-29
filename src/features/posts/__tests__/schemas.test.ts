import { describe, it, expect } from "vitest";
import {
  postDomainSchema,
  postStatusSchema,
  postRowSchema,
  postCreateSchema,
  postUpdateSchema,
} from "../schemas";

const validRow = {
  id: "f47ac10b-58cc-4372-a567-0e02b2c3d479",
  domain: "feedback",
  slug: "FB-001",
  title: "테스트 제목",
  body: "본문",
  author_email: "test@example.com",
  author_id: null,
  owner_label: "송영신",
  status: "active",
  created_at: "2026-05-09T00:00:00Z",
  updated_at: "2026-05-09T00:00:00Z",
};

describe("postDomainSchema", () => {
  it("'feedback' / 'notice' 통과", () => {
    expect(postDomainSchema.safeParse("feedback").success).toBe(true);
    expect(postDomainSchema.safeParse("notice").success).toBe(true);
  });
  it("'BAD' 거부", () => {
    expect(postDomainSchema.safeParse("BAD").success).toBe(false);
  });
});

describe("postStatusSchema", () => {
  it("4단계 통과", () => {
    expect(postStatusSchema.safeParse("urgent").success).toBe(true);
    expect(postStatusSchema.safeParse("review").success).toBe(true);
    expect(postStatusSchema.safeParse("active").success).toBe(true);
    expect(postStatusSchema.safeParse("approved").success).toBe(true);
  });
  it("그 외 거부", () => {
    expect(postStatusSchema.safeParse("BAD").success).toBe(false);
  });
});

describe("postRowSchema", () => {
  it("정상 row 통과", () => {
    const r = postRowSchema.safeParse(validRow);
    expect(r.success).toBe(true);
  });
  it("title 빈 문자열 거부", () => {
    const r = postRowSchema.safeParse({ ...validRow, title: "" });
    expect(r.success).toBe(false);
  });
  it("author_email 형식 거부", () => {
    const r = postRowSchema.safeParse({
      ...validRow,
      author_email: "not-email",
    });
    expect(r.success).toBe(false);
  });
  it("domain 누락 거부", () => {
    const { domain: _drop, ...rest } = validRow;
    void _drop;
    const r = postRowSchema.safeParse(rest);
    expect(r.success).toBe(false);
  });
});

describe("postCreateSchema", () => {
  it("최소 필수 필드 (domain/title/author_email) 통과 — status default", () => {
    const r = postCreateSchema.safeParse({
      domain: "feedback",
      title: "신규",
      author_email: "x@y.com",
    });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.status).toBe("urgent");
  });
  it("title 누락 거부", () => {
    const r = postCreateSchema.safeParse({
      domain: "feedback",
      author_email: "x@y.com",
    });
    expect(r.success).toBe(false);
  });
  it("title 빈 문자열 → 한글 안내 메시지", () => {
    const r = postCreateSchema.safeParse({
      domain: "feedback",
      title: "",
      author_email: "x@y.com",
    });
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.error.issues[0]?.message).toBe("제목을 입력해주세요");
    }
  });
});

describe("postUpdateSchema", () => {
  it("status만 update OK", () => {
    expect(postUpdateSchema.safeParse({ status: "approved" }).success).toBe(
      true,
    );
  });
  it("body만 update OK", () => {
    expect(postUpdateSchema.safeParse({ body: "수정" }).success).toBe(true);
  });
  it("status 잘못된 값 거부", () => {
    expect(postUpdateSchema.safeParse({ status: "BAD" }).success).toBe(false);
  });
});
