import { z } from "zod";

/**
 * 회의록 v2 양식 데이터 모델 (운영팀 HTML 양식 채택).
 * meetings.content(jsonb)에 이 구조로 저장한다. 기존 BlockNote 블록 배열(v1)과는
 * formVersion 유무로 구분(isMeetingDoc).
 */

// 상태 배지 — HTML 양식의 4단계(st-talk/done/follow/hold)
export const STAMP_STATUSES = ["talk", "done", "follow", "hold"] as const;
export type StampStatus = (typeof STAMP_STATUSES)[number];
export const STAMP_LABELS: Record<StampStatus, string> = {
  talk: "진행중",
  done: "완료",
  follow: "후속필요",
  hold: "보류",
};

const stampSchema = z.enum(STAMP_STATUSES);

// ── 섹션 종류 ───────────────────────────────────────────────
// 논의 내용 — station(소주제) 안에 Q&A thread (대학·질문 / 진학·답변 + 상태)
const ledgerSection = z.object({
  kind: z.literal("ledger"),
  title: z.string(),
  stations: z.array(
    z.object({
      title: z.string(),
      threads: z.array(
        z.object({ q: z.string(), a: z.string(), status: stampSchema }),
      ),
    }),
  ),
});

// 표 — 컬럼 헤더 + 행. idx(번호 자동)·status(상태배지 열) 옵션
const tableSection = z.object({
  kind: z.literal("table"),
  title: z.string(),
  headers: z.array(z.string()),
  idx: z.boolean(),
  status: z.boolean(),
  rows: z.array(
    z.object({ cells: z.array(z.string()), status: stampSchema.optional() }),
  ),
});

// 키-값 박스 (목표·범위 등)
const kvSection = z.object({
  kind: z.literal("kv"),
  title: z.string(),
  boxes: z.array(z.object({ key: z.string(), value: z.string() })),
});

const notesSection = z.object({
  kind: z.literal("notes"),
  title: z.string(),
  items: z.array(z.string()),
});

const listSection = z.object({
  kind: z.literal("list"),
  title: z.string(),
  items: z.array(z.string()),
});

// 긴급 배너 (심각도 + 요약 + 상태)
const bannerSection = z.object({
  kind: z.literal("banner"),
  sev: z.string(),
  text: z.string(),
  status: stampSchema,
});

export const sectionSchema = z.discriminatedUnion("kind", [
  ledgerSection,
  tableSection,
  kvSection,
  notesSection,
  listSection,
  bannerSection,
]);
export type Section = z.infer<typeof sectionSchema>;

export const meetingDocSchema = z.object({
  formVersion: z.literal(2),
  typeId: z.string(),
  dateline: z.array(z.object({ label: z.string(), value: z.string() })),
  titleBlock: z.array(
    z.object({
      key: z.string(),
      value: z.string(),
      span: z.number().optional(),
    }),
  ),
  sections: z.array(sectionSchema),
  approval: z.boolean(),
});
export type MeetingDoc = z.infer<typeof meetingDocSchema>;

/** content가 v2 양식 문서인지(기존 BlockNote 블록 배열과 구분). */
export function isMeetingDoc(content: unknown): content is MeetingDoc {
  return (
    !!content &&
    typeof content === "object" &&
    !Array.isArray(content) &&
    (content as { formVersion?: unknown }).formVersion === 2
  );
}
