import { describe, it, expect } from "vitest";
import {
  HANDOVER_CATEGORIES,
  HANDOVER_FIELD_KEYS,
} from "../categories";

describe("HANDOVER_CATEGORIES", () => {
  it("6개 카테고리: 계약/작업/정산/연락처/서류제출/기타", () => {
    expect(HANDOVER_CATEGORIES.map((c) => c.key)).toEqual([
      "contract",
      "work",
      "payment",
      "contact",
      "docs",
      "etc",
    ]);
    expect(HANDOVER_CATEGORIES.map((c) => c.label)).toEqual([
      "계약",
      "작업",
      "정산",
      "연락처",
      "서류제출",
      "기타",
    ]);
  });

  it("카테고리별 필드 수 — 계약 2 / 작업 7 / 정산 2 / 연락처 1 / 서류제출 1 / 기타 1", () => {
    const fieldCounts = HANDOVER_CATEGORIES.map((c) => c.fields.length);
    expect(fieldCounts).toEqual([2, 7, 2, 1, 1, 1]);
  });

  it("작업 카테고리 7 필드 — 기초·생성툴·사이트·출력물·경쟁률·전산파일·기타", () => {
    const work = HANDOVER_CATEGORIES.find((c) => c.key === "work");
    expect(work?.fields.map((f) => f.label)).toEqual([
      "기초작업",
      "생성툴",
      "사이트·페이지",
      "출력물",
      "경쟁률",
      "전산파일",
      "기타",
    ]);
  });

  it("HANDOVER_FIELD_KEYS — 14개", () => {
    expect(HANDOVER_FIELD_KEYS).toHaveLength(14);
  });

  it("HANDOVER_FIELD_KEYS 와 카테고리 필드 합산 일치", () => {
    const flat = HANDOVER_CATEGORIES.flatMap((c) =>
      c.fields.map((f) => f.key),
    );
    expect(flat).toEqual([...HANDOVER_FIELD_KEYS]);
  });

  it("모든 필드 key가 *_md 접미사", () => {
    for (const k of HANDOVER_FIELD_KEYS) {
      expect(k).toMatch(/_md$/);
    }
  });
});
