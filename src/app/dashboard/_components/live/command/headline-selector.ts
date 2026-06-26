/**
 * 자동 헤드라인 셀렉터 — 상황실 v4 .headline 섹션의 "오늘의 톱" 카피를 결정하는 순수 함수.
 *
 * urgent 우선순위: 미처리 사고 → 오늘 마감 → 미수채권 10일+.
 * 활성 urgent 항목들을 title segments로 결합하고, 가장 시급한 항목 메뉴로 href를 정한다.
 * 모든 지표가 0이면 calm 모드 — 진행 중 서비스 건수로 "순항" 카피를 보여준다.
 */

/** 팝업 항목 리스트 1행 — 시각(선택) + 제목 + 보조 상세(선택). */
export type HeadlinePreviewRow = { time?: string; title: string; sub?: string };

export type HeadlineInput = {
  incidentsUnresolved: number;
  deadlinesToday: number;
  /** 작성시작(오픈)이 임박한 건수. 미지정 시 0(오픈 임박 항목 미노출). */
  opensImminent?: number;
  overdueReceivables: number;
  inProgressServices: number;
  topDeadlineLabel?: string;
  /** 가장 임박한 마감까지 남은 일수 (0=오늘). sub의 "D-n" 표기용. */
  topDeadlineDays?: number;
  topOpenLabel?: string;
  /** 가장 임박한 오픈까지 남은 일수 (0=오늘). sub의 "D-n" 표기용. */
  topOpenDays?: number;
  topIncidentLabel?: string;
  /** 팝업 리스트용 — 항목별 미리보기 행 (없으면 빈 배열로 처리). */
  incidentRows?: HeadlinePreviewRow[];
  deadlineRows?: HeadlinePreviewRow[];
  openRows?: HeadlinePreviewRow[];
  receivableRows?: HeadlinePreviewRow[];
};

export type HeadlineSegment = { text: string; em?: boolean };

export type HeadlineResult = {
  mode: "urgent" | "calm";
  kicker: string;
  segments: HeadlineSegment[];
  sub: string;
  href: string;
  /** 긴급 원형 표시값 — 활성 urgent 항목 합계(미처리사고+오늘마감+미수채권). 헤드라인과 동일 기준. */
  urgentTotal: number;
  /** 활성 urgent 항목 — 항목별 개별 링크용(라벨/건수/href/sub/리스트). calm이면 빈 배열. */
  items: {
    label: string;
    count: number;
    href: string;
    /** 항목 고유 요약 문구(모달 상단). 마감=topDeadline, 미수=없음 등. */
    sub?: string;
    rows: HeadlinePreviewRow[];
  }[];
};

const URGENT_KICKER = "▲ 오늘의 톱 · 즉시";
const CALM_KICKER = "오늘 평온";

type UrgentItem = {
  label: string;
  count: number;
  href: string;
  subFrom: (input: HeadlineInput) => string | undefined;
  rowsFrom: (input: HeadlineInput) => HeadlinePreviewRow[];
};

/** 우선순위 순서대로 정의 — 앞쪽이 더 시급. */
function urgentItems(input: HeadlineInput): UrgentItem[] {
  return [
    {
      label: "미처리 사고",
      count: input.incidentsUnresolved,
      href: "/dashboard/incidents",
      subFrom: (i) =>
        i.topIncidentLabel ? `사고 "${i.topIncidentLabel}" 미처리` : undefined,
      rowsFrom: (i) => i.incidentRows ?? [],
    },
    {
      label: "오픈 임박",
      count: input.opensImminent ?? 0,
      href: "/dashboard/closing",
      subFrom: (i) =>
        i.topOpenLabel
          ? `${i.topOpenLabel} D-${i.topOpenDays ?? 0}`
          : undefined,
      rowsFrom: (i) => i.openRows ?? [],
    },
    {
      label: "마감 임박",
      count: input.deadlinesToday,
      href: "/dashboard/closing",
      subFrom: (i) =>
        i.topDeadlineLabel
          ? `${i.topDeadlineLabel} D-${i.topDeadlineDays ?? 0}`
          : undefined,
      rowsFrom: (i) => i.deadlineRows ?? [],
    },
    {
      label: "미수채권 10일+",
      count: input.overdueReceivables,
      href: "/dashboard/receivables",
      subFrom: () => undefined,
      rowsFrom: (i) => i.receivableRows ?? [],
    },
  ];
}

/** "마감 임박 " + {3건, em} + " · " + "미처리 사고 " + {1건, em} 형태로 결합. */
function buildSegments(active: UrgentItem[]): HeadlineSegment[] {
  const segments: HeadlineSegment[] = [];
  active.forEach((item, index) => {
    if (index > 0) {
      segments.push({ text: " · " });
    }
    segments.push({ text: `${item.label} ` });
    segments.push({ text: `${item.count}건`, em: true });
  });
  return segments;
}

function buildSub(active: UrgentItem[], input: HeadlineInput): string {
  return active
    .map((item) => item.subFrom(input))
    .filter((part): part is string => Boolean(part))
    .join(" · ");
}

export function selectHeadline(input: HeadlineInput): HeadlineResult {
  const active = urgentItems(input).filter((item) => item.count > 0);

  if (active.length > 0) {
    return {
      mode: "urgent",
      kicker: URGENT_KICKER,
      segments: buildSegments(active),
      sub: buildSub(active, input),
      href: active[0].href,
      urgentTotal: active.reduce((sum, item) => sum + item.count, 0),
      items: active.map((i) => ({
        label: i.label,
        count: i.count,
        href: i.href,
        sub: i.subFrom(input),
        rows: i.rowsFrom(input),
      })),
    };
  }

  return {
    mode: "calm",
    kicker: CALM_KICKER,
    segments: [
      { text: "긴급 건 없음 — 진행 중 " },
      { text: `${input.inProgressServices}건`, em: true },
      { text: " 순항" },
    ],
    sub: "오늘 즉시 처리할 긴급 건이 없습니다.",
    href: "/dashboard",
    urgentTotal: 0,
    items: [],
  };
}
