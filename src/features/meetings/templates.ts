import type { MeetingType } from "./schemas";

export const MEETING_SEED_HEADINGS: Record<MeetingType, string[]> = {
  regular: ["안건", "논의 내용", "결정사항", "액션아이템"],
  field: ["목적", "면담 내용", "결과·후속조치"],
  project: ["목표", "범위", "일정", "R&R", "리스크"],
  memo: ["메모", "액션아이템"],
  urgent: ["상황", "영향", "조치", "결정"],
};

const CHECK_SECTIONS = new Set(["액션아이템", "결과·후속조치"]);

export type SeedBlock =
  | { type: "heading"; props: { level: 2 }; content: string }
  | { type: "paragraph"; content: "" }
  | { type: "checkListItem"; content: "" };

export function buildSeedBlocks(type: MeetingType): SeedBlock[] {
  const out: SeedBlock[] = [];
  for (const heading of MEETING_SEED_HEADINGS[type]) {
    out.push({ type: "heading", props: { level: 2 }, content: heading });
    out.push(
      CHECK_SECTIONS.has(heading)
        ? { type: "checkListItem", content: "" }
        : { type: "paragraph", content: "" },
    );
  }
  return out;
}
