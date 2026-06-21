import { describe, it, expect } from "vitest";
import { meetingDocSchema } from "../form-model";
import { buildSeedDoc } from "../form-templates";
import { MEETING_TYPES } from "../schemas";

describe("buildSeedDoc", () => {
  it("5개 유형 모두 유효한 MeetingDoc을 생성한다", () => {
    for (const t of MEETING_TYPES) {
      const doc = buildSeedDoc(t);
      const parsed = meetingDocSchema.safeParse(doc);
      expect(parsed.success, `${t}: ${parsed.error?.message}`).toBe(true);
      expect(doc.formVersion).toBe(2);
      expect(doc.typeId).toBe(t);
      expect(doc.sections.length).toBeGreaterThan(0);
    }
  });

  it("정기회의: 지난 안건 점검·후속 조치(table) + 논의 내용(ledger) + 비고(notes)", () => {
    const doc = buildSeedDoc("regular");
    const titles = doc.sections.map((s) => ("title" in s ? s.title : ""));
    expect(titles).toContain("지난 안건 점검");
    expect(titles).toContain("논의 내용");
    expect(titles).toContain("후속 조치");
    expect(titles).toContain("비고");
    const ledger = doc.sections.find((s) => s.kind === "ledger");
    expect(ledger).toBeDefined();
  });

  it("프로젝트: 목표·범위(kv 4박스) + 마일스톤·리스크(table)", () => {
    const doc = buildSeedDoc("project");
    const kv = doc.sections.find((s) => s.kind === "kv");
    expect(kv?.kind === "kv" && kv.boxes.length).toBe(4);
  });

  it("긴급: banner 섹션 포함", () => {
    const doc = buildSeedDoc("urgent");
    expect(doc.sections.some((s) => s.kind === "banner")).toBe(true);
  });

  it("1:1 메모는 결재란 없음(approval false), 그 외 true", () => {
    expect(buildSeedDoc("memo").approval).toBe(false);
    expect(buildSeedDoc("regular").approval).toBe(true);
  });

  it("table 섹션은 빈 행을 최소 1개 가진다(컬럼 헤더는 headers로)", () => {
    const doc = buildSeedDoc("regular");
    const table = doc.sections.find((s) => s.kind === "table");
    expect(table?.kind === "table" && table.headers.length).toBeGreaterThan(0);
    expect(table?.kind === "table" && table.rows.length).toBeGreaterThanOrEqual(1);
  });
});
