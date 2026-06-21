import type { MeetingType } from "./schemas";

/**
 * 회의 유형별 회의록 양식 정의.
 * 출처: 운영팀 HTML 회의록 템플릿(docs/meeting-templates.html)을 BlockNote 시드로 재현.
 * 새 회의록 생성 시 buildSeedBlocks가 이 정의를 빈 양식(컬럼 헤더 + 빈 행)으로 시드한다.
 */
type Sec =
  // 표: 컬럼 헤더만 두고 빈 행을 시드 (샘플 데이터는 넣지 않음)
  | { kind: "table"; title: string; headers: string[] }
  // 논의 내용: '논의·질문 내용 / 답변·결정 내용' 2열 표
  | { kind: "ledger"; title: string }
  // 키-값 박스: 각 키를 하위 heading + 빈 문단으로
  | { kind: "kv"; title: string; keys: string[] }
  // 자유 메모/목록: 빈 bullet
  | { kind: "notes"; title: string }
  | { kind: "list"; title: string };

const LEDGER_HEADERS = ["논의·질문 내용", "답변·결정 내용"];

export const MEETING_TEMPLATES: Record<MeetingType, Sec[]> = {
  regular: [
    { kind: "table", title: "지난 안건 점검", headers: ["#", "지난 안건", "담당", "상태"] },
    { kind: "ledger", title: "논의 내용" },
    {
      kind: "table",
      title: "후속 조치",
      headers: ["#", "조치 사항", "담당", "기한", "상태"],
    },
    { kind: "notes", title: "비고" },
  ],
  field: [
    { kind: "ledger", title: "논의 내용" },
    {
      kind: "table",
      title: "후속 조치",
      headers: ["#", "조치 사항", "담당", "기한", "상태"],
    },
    { kind: "notes", title: "비고" },
  ],
  project: [
    {
      kind: "kv",
      title: "목표 · 범위",
      keys: ["프로젝트 목표", "성공 기준", "범위 (In)", "범위 (Out)"],
    },
    { kind: "table", title: "역할 분담", headers: ["이름·조직", "역할", "R/A/C/I"] },
    { kind: "table", title: "마일스톤", headers: ["단계 · 산출물", "기한", "상태"] },
    { kind: "table", title: "리스크 · 가정", headers: ["리스크 · 가정", "심각도"] },
    { kind: "notes", title: "결정 · 비고" },
  ],
  memo: [
    { kind: "list", title: "이야기 나눈 것" },
    { kind: "list", title: "합의 · 결정" },
    { kind: "table", title: "후속", headers: ["할 일", "기한", "상태"] },
  ],
  urgent: [
    { kind: "table", title: "대응 타임라인", headers: ["시각", "대응 내용"] },
    { kind: "kv", title: "영향 · 원인", keys: ["영향", "근본 원인"] },
    { kind: "table", title: "재발 방지", headers: ["#", "조치", "담당", "상태"] },
    { kind: "notes", title: "비고" },
  ],
};

export type SeedBlock =
  | { type: "heading"; props: { level: 2 | 3 }; content: string }
  | { type: "paragraph"; content: "" }
  | { type: "checkListItem"; content: "" }
  | { type: "bulletListItem"; content: "" }
  | {
      type: "table";
      content: { type: "tableContent"; headerRows: number; rows: { cells: string[] }[] };
    };

/** 컬럼 헤더 + 빈 데이터 행 2개로 표 블록 생성 (헤더 행은 headerRows로 고정). */
function tableBlock(headers: string[]): SeedBlock {
  const empty = (): { cells: string[] } => ({ cells: headers.map(() => "") });
  return {
    type: "table",
    content: {
      type: "tableContent",
      headerRows: 1,
      rows: [{ cells: headers }, empty(), empty()],
    },
  };
}

/**
 * 유형별 회의록 빈 양식 블록 시드.
 * 각 섹션 title을 heading(2)으로, 내용은 종류별로:
 * table→표 / ledger→2열 표 / kv→하위 heading(3)+빈 문단 / notes·list→빈 bullet.
 */
export function buildSeedBlocks(type: MeetingType): SeedBlock[] {
  const out: SeedBlock[] = [];
  for (const sec of MEETING_TEMPLATES[type]) {
    out.push({ type: "heading", props: { level: 2 }, content: sec.title });
    switch (sec.kind) {
      case "table":
        out.push(tableBlock(sec.headers));
        break;
      case "ledger":
        out.push(tableBlock(LEDGER_HEADERS));
        break;
      case "kv":
        for (const key of sec.keys) {
          out.push({ type: "heading", props: { level: 3 }, content: key });
          out.push({ type: "paragraph", content: "" });
        }
        break;
      case "notes":
      case "list":
        out.push({ type: "bulletListItem", content: "" });
        out.push({ type: "bulletListItem", content: "" });
        break;
    }
  }
  return out;
}
