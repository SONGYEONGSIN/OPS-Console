import type { MeetingType } from "./schemas";
import type { MeetingDoc, Section } from "./form-model";

/**
 * 회의 유형별 빈 양식 시드 (운영팀 HTML 템플릿 docs/meeting-templates.html 이식).
 * 새 회의록 생성 시 buildSeedDoc(type)로 빈 양식 MeetingDoc을 만든다.
 * HTML 키(kickoff/oneonone/incident) ↔ DB MeetingType(project/memo/urgent) 매핑.
 */

// ── 섹션 빌더 (빈 양식: 값은 비우고 골격만) ──
const tableSec = (
  title: string,
  headers: string[],
  opt: { idx?: boolean; status?: boolean } = {},
): Section => {
  const dataCols = headers.length - (opt.idx ? 1 : 0) - (opt.status ? 1 : 0);
  return {
    kind: "table",
    title,
    headers,
    idx: opt.idx ?? false,
    status: opt.status ?? false,
    rows: [
      { cells: Array.from({ length: dataCols }, () => ""), status: opt.status ? "talk" : undefined },
    ],
  };
};
const ledgerSec = (title: string): Section => ({
  kind: "ledger",
  title,
  stations: [{ title: "", threads: [{ q: "", a: "", status: "talk" }] }],
});
const kvSec = (title: string, keys: string[]): Section => ({
  kind: "kv",
  title,
  boxes: keys.map((key) => ({ key, value: "" })),
});
const notesSec = (title: string): Section => ({ kind: "notes", title, items: [""] });
const listSec = (title: string): Section => ({ kind: "list", title, items: [""] });
const bannerSec = (): Section => ({ kind: "banner", sev: "", text: "", status: "follow" });

const dl = (...labels: string[]) => labels.map((label) => ({ label, value: "" }));
const tb = (...specs: ([string] | [string, number])[]) =>
  specs.map(([key, span]) => ({ key, value: "", ...(span ? { span } : {}) }));

type Template = Omit<MeetingDoc, "formVersion" | "typeId">;

const TEMPLATES: Record<MeetingType, Template> = {
  regular: {
    dateline: dl("일자", "시간"),
    titleBlock: tb(["회의명"], ["주관"], ["회차"], ["장소"], ["참석자", 4]),
    approval: true,
    sections: [
      tableSec("지난 안건 점검", ["#", "지난 안건", "담당", "상태"], { idx: true, status: true }),
      ledgerSec("논의 내용"),
      tableSec("후속 조치", ["#", "조치 사항", "담당", "기한", "상태"], { idx: true, status: true }),
      notesSec("비고"),
    ],
  },
  field: {
    dateline: dl("장소", "일자", "시간"),
    titleBlock: tb(["소속"], ["작성"], ["분류"], ["문서번호"], ["목적", 4], ["참석자", 4]),
    approval: true,
    sections: [
      ledgerSec("논의 내용"),
      tableSec("후속 조치", ["#", "조치 사항", "담당", "기한", "상태"], { idx: true, status: true }),
      notesSec("비고"),
    ],
  },
  project: {
    dateline: dl("일자", "시간"),
    titleBlock: tb(["프로젝트"], ["PM"], ["기간"], ["스폰서"], ["참석자", 4]),
    approval: true,
    sections: [
      kvSec("목표 · 범위", ["프로젝트 목표", "성공 기준", "범위 (In)", "범위 (Out)"]),
      tableSec("역할 분담", ["이름·조직", "역할", "R/A/C/I"]),
      tableSec("마일스톤", ["단계 · 산출물", "기한", "상태"], { status: true }),
      tableSec("리스크 · 가정", ["리스크 · 가정", "심각도"], { status: true }),
      notesSec("결정 · 비고"),
    ],
  },
  memo: {
    dateline: dl("일자", "시간"),
    titleBlock: tb(["대상"], ["작성"], ["분류"], ["장소"]),
    approval: false, // oneonone: noApproval
    sections: [
      listSec("이야기 나눈 것"),
      listSec("합의 · 결정"),
      tableSec("후속", ["할 일", "기한", "상태"], { status: true }),
    ],
  },
  urgent: {
    dateline: dl("발생", "종료"),
    titleBlock: tb(["이슈명"], ["심각도"], ["대응 담당"], ["보고자"], ["영향 범위", 4]),
    approval: true,
    sections: [
      bannerSec(),
      tableSec("대응 타임라인", ["시각", "대응 내용"]),
      kvSec("영향 · 원인", ["영향", "근본 원인"]),
      tableSec("재발 방지", ["#", "조치", "담당", "상태"], { idx: true, status: true }),
      notesSec("비고"),
    ],
  },
};

export function buildSeedDoc(type: MeetingType): MeetingDoc {
  return { formVersion: 2, typeId: type, ...TEMPLATES[type] };
}
