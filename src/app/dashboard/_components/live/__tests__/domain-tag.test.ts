import { describe, it, expect } from "vitest";

import { SOLID_BADGE, STATUS_DOT, TRIAGE_REF } from "../domain-tag";

describe("domain-tag 토큰 맵", () => {
  it("SOLID_BADGE는 9개 도메인 배지를 모두 정의한다", () => {
    const domains = [
      "사고",
      "할일",
      "서비스",
      "백업",
      "일정",
      "인수인계",
      "계약",
      "공지",
      "미수채권",
    ] as const;
    for (const d of domains) {
      expect(SOLID_BADGE[d]).toMatch(/bg-/);
      expect(SOLID_BADGE[d]).toMatch(/text-cream/);
    }
  });

  it("STATUS_DOT / TRIAGE_REF는 4개 시급도 버킷을 모두 정의한다", () => {
    const buckets = ["now", "today", "week", "track"] as const;
    for (const b of buckets) {
      expect(STATUS_DOT[b]).toMatch(/bg-/);
      expect(TRIAGE_REF[b].label).toBeTruthy();
      expect(TRIAGE_REF[b].cls).toBeTruthy();
    }
    expect(TRIAGE_REF.now.cls).toMatch(/bg-vermilion/);
  });
});
