import { describe, it, expect } from "vitest";
import { paginateRows, DEFAULT_PAGE_SIZE } from "../paginate";

const make = (n: number) => Array.from({ length: n }, (_, i) => i);

describe("paginateRows", () => {
  it("기본 페이지 크기 30", () => {
    expect(DEFAULT_PAGE_SIZE).toBe(30);
  });

  it("전체가 페이지 크기 이하면 그대로 (total/totalPages)", () => {
    const r = paginateRows(make(12), undefined);
    expect(r.total).toBe(12);
    expect(r.totalPages).toBe(1);
    expect(r.page).toBe(1);
    expect(r.rows).toHaveLength(12);
  });

  it("페이지 단위 slice — 2페이지", () => {
    const r = paginateRows(make(65), "2");
    expect(r.total).toBe(65);
    expect(r.totalPages).toBe(3);
    expect(r.page).toBe(2);
    expect(r.rows).toEqual(make(65).slice(30, 60));
  });

  it("범위 초과 page는 마지막 페이지로 clamp", () => {
    const r = paginateRows(make(65), "99");
    expect(r.page).toBe(3);
    expect(r.rows).toEqual(make(65).slice(60, 65));
  });

  it("잘못된/빈 pageParam은 1페이지", () => {
    expect(paginateRows(make(50), undefined).page).toBe(1);
    expect(paginateRows(make(50), "abc").page).toBe(1);
    expect(paginateRows(make(50), "0").page).toBe(1);
  });

  it("빈 목록 — total 0, totalPages 1, rows 빈 배열", () => {
    const r = paginateRows([], "1");
    expect(r.total).toBe(0);
    expect(r.totalPages).toBe(1);
    expect(r.rows).toEqual([]);
  });

  it("커스텀 pageSize", () => {
    const r = paginateRows(make(25), "2", 10);
    expect(r.totalPages).toBe(3);
    expect(r.rows).toEqual(make(25).slice(10, 20));
  });
});
