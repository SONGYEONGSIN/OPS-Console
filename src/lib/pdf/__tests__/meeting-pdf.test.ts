import { describe, it, expect } from "vitest";
import { renderToBuffer } from "@react-pdf/renderer";
import { renderMeetingPdf } from "../meeting-pdf";
import type { MeetingRow } from "@/features/meetings/schemas";
import { buildSeedDoc } from "@/features/meetings/form-templates";

const base: MeetingRow = {
  id: "00000000-0000-0000-0000-000000000001",
  type: "regular",
  title: "주간 운영 회의",
  meeting_date: "2026-06-10T09:00:00+09:00",
  location: "본사 3층 회의실",
  attendees: ["송영신", "이해영"],
  status: "draft",
  content: [
    {
      type: "heading",
      props: { level: 2 },
      content: [{ type: "text", text: "안건", styles: {} }],
    },
    {
      type: "bulletListItem",
      content: [{ type: "text", text: "미수채권 현황", styles: {} }],
    },
    {
      type: "checkListItem",
      props: { checked: true },
      content: [{ type: "text", text: "완료 항목", styles: { bold: true } }],
    },
    {
      type: "paragraph",
      content: [{ type: "text", text: "본문 단락", styles: {} }],
    },
  ],
} as unknown as MeetingRow;

describe("renderMeetingPdf", () => {
  it("PDF Buffer(%PDF magic, >1KB)를 반환한다", { timeout: 20000 }, async () => {
    const buf = await renderToBuffer(renderMeetingPdf(base));
    expect(Buffer.isBuffer(buf)).toBe(true);
    expect(buf.subarray(0, 4).toString()).toBe("%PDF");
    expect(buf.byteLength).toBeGreaterThan(1000);
  });

  it(
    "null 메타 / 빈 본문도 안전하게 렌더",
    { timeout: 20000 },
    async () => {
      const buf = await renderToBuffer(
        renderMeetingPdf({
          ...base,
          meeting_date: null,
          location: null,
          attendees: [],
          content: [],
        } as unknown as MeetingRow),
      );
      expect(buf.subarray(0, 4).toString()).toBe("%PDF");
    },
  );

  it(
    "v2 양식 문서(MeetingDoc)도 PDF로 렌더한다",
    { timeout: 20000 },
    async () => {
      for (const t of ["regular", "project", "urgent"] as const) {
        const buf = await renderToBuffer(
          renderMeetingPdf({
            ...base,
            type: t,
            content: buildSeedDoc(t),
          } as unknown as MeetingRow),
        );
        expect(buf.subarray(0, 4).toString()).toBe("%PDF");
        expect(buf.byteLength).toBeGreaterThan(1000);
      }
    },
  );
});
