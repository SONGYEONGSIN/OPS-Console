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

describe("selectHeadline — 항목 preview rows", () => {
  it("각 urgent 항목에 대응하는 preview rows를 attach한다", () => {
    const r = selectHeadline({
      ...ZERO,
      deadlinesToday: 2,
      deadlineRows: [
        { time: "06.16", title: "단국대 · 외국인-Freshman" },
        { time: "06.18", title: "단국대 · 외국인-Transfer" },
      ],
    });
    const deadlineItem = r.items.find((i) => i.label === "마감 임박");
    expect(deadlineItem?.rows).toHaveLength(2);
    expect(deadlineItem?.rows[0]).toEqual({
      time: "06.16",
      title: "단국대 · 외국인-Freshman",
    });
  });

  it("rows 미제공 시 빈 배열", () => {
    const r = selectHeadline({ ...ZERO, overdueReceivables: 3 });
    expect(r.items[0].rows).toEqual([]);
  });

  it("각 항목은 자기 sub를 가진다 — 마감은 topDeadline, 미수는 없음", () => {
    const r = selectHeadline({
      ...ZERO,
      deadlinesToday: 2,
      overdueReceivables: 3,
      topDeadlineLabel: "동서대학교 · 신/편입학모집",
      topDeadlineDays: 1,
    });
    const deadlineItem = r.items.find((i) => i.label === "마감 임박");
    const receivableItem = r.items.find((i) => i.label === "미수채권 10일+");
    expect(deadlineItem?.sub).toBe("동서대학교 · 신/편입학모집 D-1");
    // 미수채권 항목은 마감 문구가 새어들지 않아야 한다(자체 sub 없음).
    expect(receivableItem?.sub).toBeUndefined();
  });
});

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
