import { describe, it, expect } from "vitest";
import { renderChecklistPdf } from "../checklist-pdf";
import type { ChecklistRound, ChecklistItem } from "@/features/checklist/schemas";

const round: ChecklistRound = {
  id: "11111111-1111-1111-1111-111111111111",
  title: "2027학년도 수시모집",
  periodStart: "2026-08-01",
  periodEnd: "2026-09-01",
  status: "active",
  createdBy: "ys1114@x.com",
  createdAt: "2026-07-22T10:00:00Z",
};
const items: ChecklistItem[] = [
  { id: "i1", roundId: round.id, department: "개발부", category: "서버/시스템", title: "웹 서버 동작 확인", status: "done", note: "정상", sortOrder: 0 },
  { id: "i2", roundId: round.id, department: "운영부", category: "결제사", title: "결제사 세팅", status: "in_progress", note: "", sortOrder: 0 },
];

describe("renderChecklistPdf", () => {
  it("유효한 PDF Buffer 반환 (%PDF 시그너처)", async () => {
    const buf = await renderChecklistPdf(round, items);
    expect(Buffer.isBuffer(buf)).toBe(true);
    expect(buf.length).toBeGreaterThan(1000);
    expect(buf.subarray(0, 5).toString("latin1")).toBe("%PDF-");
  }, 15000);

  it("빈 항목이어도 렌더된다", async () => {
    const buf = await renderChecklistPdf(round, []);
    expect(buf.length).toBeGreaterThan(1000);
  }, 15000);
});
