import type { MeetingType } from "./schemas";

// 회의 유형별 표준 회의록 구조 (일반적인 meeting-minutes 모범 양식 기준으로 보강).
export const MEETING_SEED_HEADINGS: Record<MeetingType, string[]> = {
  regular: [
    "참석자",
    "지난 회의 후속 점검",
    "안건",
    "논의 내용",
    "결정사항",
    "액션아이템",
    "다음 회의",
  ],
  field: ["방문 개요", "목적", "면담 내용", "주요 결과", "이슈·특이사항", "후속조치"],
  project: [
    "프로젝트 개요",
    "목표·범위",
    "주요 일정",
    "역할·R&R",
    "리스크·이슈",
    "예산·리소스",
    "액션아이템",
  ],
  memo: ["논의 주제", "메모", "액션아이템", "다음 체크인"],
  urgent: [
    "상황 요약",
    "영향 범위",
    "원인 분석",
    "조치 내역",
    "결정사항",
    "재발 방지",
    "후속 모니터링",
  ],
};

// 체크리스트(할 일)로 시작하는 게 자연스러운 섹션.
const CHECK_SECTIONS = new Set([
  "액션아이템",
  "후속조치",
  "재발 방지",
  "후속 모니터링",
  "지난 회의 후속 점검",
]);

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
