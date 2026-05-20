import { describe, it, expect } from "vitest";
import { matchesReceivablesQuery } from "../_row-mapper";
import type { ListRow } from "../../_components/patterns/ListPattern";

const row: ListRow = {
  id: "r-0",
  name: "한양대학교",
  body: "정시 광고 게재",
  status: "active",
  owner: "송영신",
  author: "1,000,000",
  meta: "2026-05-01",
};

describe("matchesReceivablesQuery", () => {
  it("빈/공백 term → 항상 true (필터 없음)", () => {
    expect(matchesReceivablesQuery(row, "")).toBe(true);
    expect(matchesReceivablesQuery(row, "   ")).toBe(true);
  });

  it("거래처(name) 부분 매칭", () => {
    expect(matchesReceivablesQuery(row, "한양")).toBe(true);
  });

  it("내역(body) 부분 매칭", () => {
    expect(matchesReceivablesQuery(row, "광고")).toBe(true);
  });

  it("운영자(owner) 매칭", () => {
    expect(matchesReceivablesQuery(row, "송영신")).toBe(true);
  });

  it("대소문자 무시", () => {
    expect(matchesReceivablesQuery({ ...row, name: "Hanyang" }, "hanYANG")).toBe(
      true,
    );
  });

  it("매칭 없으면 false", () => {
    expect(matchesReceivablesQuery(row, "고려대")).toBe(false);
  });
});
