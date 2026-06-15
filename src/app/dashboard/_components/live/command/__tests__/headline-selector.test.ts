import { describe, it, expect } from "vitest";
import { selectHeadline } from "../headline-selector";
import type { HeadlineInput } from "../headline-selector";

const ZERO: HeadlineInput = {
  incidentsUnresolved: 0,
  deadlinesToday: 0,
  overdueReceivables: 0,
  inProgressServices: 0,
};

function plainText(segments: { text: string }[]): string {
  return segments.map((s) => s.text).join("");
}

describe("selectHeadline — urgent 우선순위", () => {
  it("미처리 사고가 가장 시급 — href는 사고 메뉴", () => {
    const r = selectHeadline({
      ...ZERO,
      incidentsUnresolved: 1,
      deadlinesToday: 3,
      overdueReceivables: 4,
    });
    expect(r.mode).toBe("urgent");
    expect(r.href).toBe("/dashboard/incidents");
    expect(r.kicker).toBe("▲ 오늘의 톱 · 즉시");
  });

  it("사고 없고 마감 임박 있으면 — href는 서비스 마감 메뉴", () => {
    const r = selectHeadline({
      ...ZERO,
      deadlinesToday: 3,
      overdueReceivables: 4,
    });
    expect(r.mode).toBe("urgent");
    expect(r.href).toBe("/dashboard/closing");
  });

  it("사고·마감 없고 미수만 있으면 — href는 미수채권 메뉴", () => {
    const r = selectHeadline({ ...ZERO, overdueReceivables: 4 });
    expect(r.mode).toBe("urgent");
    expect(r.href).toBe("/dashboard/receivables");
  });

  it("활성 urgent 항목들을 title segments로 결합 — 마감·사고 동시", () => {
    const r = selectHeadline({
      ...ZERO,
      incidentsUnresolved: 1,
      deadlinesToday: 3,
    });
    const text = plainText(r.segments);
    expect(text).toContain("마감 임박");
    expect(text).toContain("3건");
    expect(text).toContain("미처리 사고");
    expect(text).toContain("1건");
    // 수치는 em 강조
    const emTexts = r.segments.filter((s) => s.em).map((s) => s.text);
    expect(emTexts).toContain("3건");
    expect(emTexts).toContain("1건");
  });

  it("sub는 topIncidentLabel / topDeadlineLabel로 구성", () => {
    const r = selectHeadline({
      ...ZERO,
      incidentsUnresolved: 1,
      deadlinesToday: 1,
      topIncidentLabel: "원서 작성페이지 오류",
      topDeadlineLabel: "건국대(글로벌) 후기 2차",
    });
    expect(r.sub).toContain("원서 작성페이지 오류");
    expect(r.sub).toContain("건국대(글로벌) 후기 2차");
  });
});

describe("selectHeadline — calm", () => {
  it("모든 지표 0이면 calm 모드", () => {
    const r = selectHeadline({ ...ZERO, inProgressServices: 28 });
    expect(r.mode).toBe("calm");
    expect(r.kicker).toBe("오늘 평온");
    expect(r.href).toBe("/dashboard");
    expect(r.sub).toBe("오늘 즉시 처리할 긴급 건이 없습니다.");
    const text = plainText(r.segments);
    expect(text).toContain("긴급 건 없음");
    expect(text).toContain("28건");
    expect(text).toContain("순항");
    const emTexts = r.segments.filter((s) => s.em).map((s) => s.text);
    expect(emTexts).toContain("28건");
  });
});
