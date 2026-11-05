import {
  DOC_KINDS,
  type DocKind,
  type DocStatus,
} from "@/features/sms-sender/types";

/**
 * _서류 시트의 표시 → 인스펙터 글자. 'O'·'✕'·'대체'·빈 칸만 뜻을 준다 —
 * 모르는 표시(X·× 등)까지 '대체 인정' 으로 그리면 미제출이 뒤집혀 보이고
 * 아무 오류도 안 난다. 그래서 모르는 표시는 원문을 그대로 보인다.
 */
export function markLabel(mark: string): {
  text: string;
  aria: string;
  className: string;
} {
  if (mark === "O")
    return { text: "제출", aria: "제출", className: "text-ink" };
  if (mark === "✕")
    return {
      text: "미제출",
      aria: "미제출",
      className: "border border-vermilion px-1.5 text-xs text-vermilion",
    };
  if (mark === "대체")
    return { text: "대체 인정", aria: "대체 인정", className: "text-muted" };
  if (!mark) return { text: "-", aria: "표시 없음", className: "text-muted" };
  const text = `알 수 없음(${mark})`;
  return { text, aria: text, className: "text-muted" };
}

export type DocTally = {
  /** 'O' 또는 '대체' */
  submitted: number;
  total: number;
  /** '✕' — DOC_KINDS 순서 */
  missing: DocKind[];
  /** 빈 칸·모르는 표시 — 제출도 미제출도 아니다 */
  unknown: number;
};

/** 학교 표 서류 칸과 인스펙터 건수가 같이 쓴다. */
export function docTally(docs: DocStatus): DocTally {
  const marks = DOC_KINDS.map((k) => [k, docs.marks[k]] as const);
  const submitted = marks.filter(([, m]) => m === "O" || m === "대체").length;
  const missing = marks.filter(([, m]) => m === "✕").map(([k]) => k);
  return {
    submitted,
    total: DOC_KINDS.length,
    missing,
    unknown: DOC_KINDS.length - submitted - missing.length,
  };
}
