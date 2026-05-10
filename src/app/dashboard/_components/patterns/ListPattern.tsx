"use client";

import { useState } from "react";
import { InspectorPanel } from "../inspector/InspectorPanel";
import { InspectorListBody } from "../inspector/InspectorListBody";
import { useInspectorState } from "../inspector/useInspectorState";
import {
  PERMISSION_LABEL,
  type OperatorPermission,
} from "@/features/operators/schemas";

export type ListRow = {
  id: string;
  name: string;
  status:
    | "urgent"
    | "active"
    | "review"
    | "approved"
    | "inactive"
    | "suspended"
    | "deleted";
  owner: string;
  meta?: string;
  /** 직속 상사 이름 — 미설정 시 leaderOf로 자동 derive (TeamView). */
  leader?: string;
  /** 상태=deleted 일 때 사유 (operators 도메인) */
  deletedReason?: string;
  /** team 도메인 — 시스템 권한 (admin/member/viewer) */
  permission?: OperatorPermission;
  /** post 도메인 — 게시글 본문 */
  body?: string;
  /** post 도메인 — 등록자 (작성자). owner는 처리 담당자로 분리. */
  author?: string;
  /** team 도메인 — 메뉴 접근 권한 (slug 배열). admin은 빈 배열로 두고 bypass. */
  allowedMenus?: string[];
  /** post 도메인 — 사람 친화 글번호 (예: 'FB-001'). 없으면 id(uuid) 단축 표시. */
  slug?: string;
  /** schedule 도메인 — 일정 분류 (shift/event/leave/training). */
  scheduleType?: "shift" | "event" | "leave" | "training";
  /** schedule 도메인 — ISO 8601 timestamptz */
  start_at?: string;
  /** schedule 도메인 — ISO 8601 timestamptz, 종료 미정 시 null/undefined */
  end_at?: string | null;
  /** schedule 도메인 — 종일 이벤트 여부 */
  allDay?: boolean;
  /** schedule 도메인 — 담당자 이메일 (팀 공통이면 null/undefined) */
  assigneeEmail?: string | null;
  /** schedule 도메인 — 등록자 이메일 */
  createdByEmail?: string;
  /** my-todo 도메인 — 우선순위 */
  priority?: "low" | "medium" | "high";
  /** my-todo 도메인 — 완료 여부 */
  done?: boolean;
  /** my-todo 도메인 — 완료 시각 ISO */
  doneAt?: string | null;
  /** my-todo 도메인 — 마감 ISO (nullable) */
  dueAt?: string | null;
  /** onboarding cohort — 신입 이메일 */
  traineeEmail?: string;
  /** onboarding cohort — 사수 이메일 (nullable) */
  mentorEmail?: string | null;
  /** onboarding cohort — 시작일 (YYYY-MM-DD) */
  startDate?: string;
  /** onboarding cohort — 종료일 (YYYY-MM-DD, nullable) */
  endDate?: string | null;
  /** onboarding cohort — 상태 enum */
  cohortStatus?: "planned" | "in_progress" | "completed";
};

export type ScheduleType = NonNullable<ListRow["scheduleType"]>;
export type TodoPriority = NonNullable<ListRow["priority"]>;
export type MyTodoFilter = "done" | "undone" | "today" | "due-soon";
export type CohortStatus = NonNullable<ListRow["cohortStatus"]>;

const PERMISSION_COLOR: Record<OperatorPermission, string> = {
  admin: "bg-vermilion/30 text-vermilion-deep font-medium",
  member: "bg-ink/15 text-ink font-medium",
  viewer: "bg-muted/30 text-ink-soft font-medium",
};

const STATUS_LABEL: Record<ListRow["status"], string> = {
  // 기존 default variant
  urgent: "긴급",
  approved: "정상",
  review: "점검중",
  // operators 도메인
  active: "활성",
  inactive: "점검중",
  suspended: "정지",
  deleted: "삭제",
};

/**
 * post-feedback 4단계 흐름 — 등록자가 글 등록(요청) → admin이 확인 → 처리중 → 처리완료.
 * STATUS_COLOR는 의미 일관(urgent=red 강조 / approved=muted 종료)이라 그대로 사용.
 */
const FEEDBACK_STATUS_LABEL: Record<ListRow["status"], string> = {
  urgent: "요청",
  review: "확인",
  active: "처리중",
  approved: "처리완료",
  inactive: "보류",
  suspended: "중단",
  deleted: "삭제",
};

/**
 * post-notice 3단계 흐름 — 긴급(우선 강조) / 활성(현재 게시 중) / 종료(지난 공지).
 */
const NOTICE_STATUS_LABEL: Record<ListRow["status"], string> = {
  urgent: "긴급",
  active: "활성",
  approved: "종료",
  review: "예약",
  inactive: "보류",
  suspended: "중단",
  deleted: "삭제",
};

function postLabelFor(variant: "post-feedback" | "post-notice"): Record<ListRow["status"], string> {
  return variant === "post-notice" ? NOTICE_STATUS_LABEL : FEEDBACK_STATUS_LABEL;
}

const FEEDBACK_STATUS_KEYS: ListRow["status"][] = [
  "urgent",
  "review",
  "active",
  "approved",
];

const NOTICE_STATUS_KEYS: ListRow["status"][] = ["urgent", "active", "approved"];

export function postStatusKeys(
  variant: "post-feedback" | "post-notice"
): ListRow["status"][] {
  return variant === "post-notice" ? NOTICE_STATUS_KEYS : FEEDBACK_STATUS_KEYS;
}

export function postStatusLabel(
  variant: "post-feedback" | "post-notice",
  status: ListRow["status"]
): string {
  return postLabelFor(variant)[status];
}

const STATUS_COLOR: Record<ListRow["status"], string> = {
  urgent: "bg-vermilion text-cream",
  approved: "bg-line-soft text-muted",
  review: "bg-gold/20 text-gold",
  active: "bg-sage/20 text-sage",
  inactive: "bg-gold/20 text-gold",
  suspended: "bg-vermilion/20 text-vermilion",
  deleted: "bg-ink/20 text-ink-soft",
};

const STATUS_RING: Record<ListRow["status"], string> = {
  urgent: "bg-vermilion",
  approved: "bg-muted",
  review: "bg-gold",
  active: "bg-sage",
  inactive: "bg-gold",
  suspended: "bg-vermilion",
  deleted: "bg-muted",
};

type Filter = ListRow["status"] | "all" | ScheduleType | MyTodoFilter | CohortStatus;

const COHORT_STATUS_LABEL: Record<CohortStatus, string> = {
  planned: "계획",
  in_progress: "진행중",
  completed: "완료",
};

const COHORT_STATUS_COLOR: Record<CohortStatus, string> = {
  planned: "bg-line-soft text-muted",
  in_progress: "bg-vermilion text-cream",
  completed: "bg-washi-raised text-ink",
};

const PRIORITY_LABEL: Record<TodoPriority, string> = {
  high: "높음",
  medium: "보통",
  low: "낮음",
};

const PRIORITY_COLOR: Record<TodoPriority, string> = {
  high: "bg-vermilion text-cream",
  medium: "bg-line-soft text-ink",
  low: "bg-washi-raised text-muted",
};

const SCHEDULE_TYPE_LABEL: Record<ScheduleType, string> = {
  shift: "시프트",
  event: "이벤트",
  leave: "휴가",
  training: "교육",
};

const SCHEDULE_TYPE_COLOR: Record<ScheduleType, string> = {
  shift: "bg-vermilion text-cream",
  event: "bg-ink text-cream",
  leave: "bg-line-soft text-muted",
  training: "bg-washi-raised text-ink",
};

/**
 * variant별 필터 적용. 모든 분기를 한 곳에 모아 분기 폭증 방지.
 */
function filterRows(
  rows: ListRow[],
  filter: Filter,
  variant: string,
): ListRow[] {
  if (filter === "all") return rows;
  if (variant === "schedule") return rows.filter((r) => r.scheduleType === filter);
  if (variant === "my-todo") {
    if (filter === "done") return rows.filter((r) => r.done === true);
    if (filter === "undone") return rows.filter((r) => !r.done);
    if (filter === "today") {
      const todayKey = todayKstKey();
      return rows.filter((r) => r.dueAt && kstDateKey(r.dueAt) === todayKey);
    }
    if (filter === "due-soon") {
      // 미완 + 마감일 3일 이내
      const limit = Date.now() + 3 * 24 * 60 * 60 * 1000;
      return rows.filter(
        (r) => !r.done && r.dueAt && new Date(r.dueAt).getTime() <= limit,
      );
    }
    return rows;
  }
  if (variant === "cohort") {
    return rows.filter((r) => r.cohortStatus === filter);
  }
  return rows.filter((r) => r.status === filter);
}

function todayKstKey(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul" }).format(
    new Date(),
  );
}

function kstDateKey(iso: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul" }).format(
    new Date(iso),
  );
}

/**
 * cohort 시작/종료일을 'M/D ~ M/D' 또는 'M/D ~' 로 포맷 (date-only).
 */
function formatCohortRange(start?: string, end?: string | null): string {
  if (!start) return "-";
  const fmt = new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    month: "numeric",
    day: "numeric",
  });
  const startStr = fmt.format(new Date(start));
  if (!end) return `${startStr} ~`;
  return `${startStr} ~ ${fmt.format(new Date(end))}`;
}

/**
 * 마감일을 짧은 KST 한국어로 포맷 ('M/D(요일)' 또는 '내일' 등).
 */
function formatDueAt(iso?: string | null): string {
  if (!iso) return "-";
  const today = todayKstKey();
  const target = kstDateKey(iso);
  if (target === today) return "오늘";
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    month: "numeric",
    day: "numeric",
    weekday: "short",
  }).format(new Date(iso));
}

/**
 * 일정 시각 범위를 KST 한국어로 포맷.
 * - all_day: '5/15(목)' 또는 '5/15(목)~5/16(금)'
 * - 같은 날짜: '5/15(목) 10:00~11:00'
 * - 다른 날짜: '5/15 10:00 ~ 5/16 02:00'
 */
function formatScheduleRange(
  start?: string,
  end?: string | null,
  allDay?: boolean,
): string {
  if (!start) return "-";
  const tz = "Asia/Seoul";
  const startD = new Date(start);
  const endD = end ? new Date(end) : null;
  const dayFmt = new Intl.DateTimeFormat("ko-KR", {
    timeZone: tz,
    month: "numeric",
    day: "numeric",
    weekday: "short",
  });
  const timeFmt = new Intl.DateTimeFormat("ko-KR", {
    timeZone: tz,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const isoDate = (d: Date) =>
    new Intl.DateTimeFormat("en-CA", { timeZone: tz }).format(d);
  if (allDay) {
    if (!endD || isoDate(startD) === isoDate(endD)) return dayFmt.format(startD);
    return `${dayFmt.format(startD)} ~ ${dayFmt.format(endD)}`;
  }
  if (!endD) return `${dayFmt.format(startD)} ${timeFmt.format(startD)}`;
  if (isoDate(startD) === isoDate(endD)) {
    return `${dayFmt.format(startD)} ${timeFmt.format(startD)}~${timeFmt.format(endD)}`;
  }
  return `${dayFmt.format(startD)} ${timeFmt.format(startD)} ~ ${dayFmt.format(endD)} ${timeFmt.format(endD)}`;
}

const DEFAULT_FILTERS: { value: Filter; label: string }[] = [
  { value: "all", label: "전체" },
  { value: "urgent", label: "긴급" },
  { value: "active", label: "활성" },
  { value: "review", label: "점검중" },
  { value: "approved", label: "정상" },
];

const TEAM_FILTERS: { value: Filter; label: string }[] = [
  { value: "all", label: "전체" },
  { value: "active", label: "활성" },
  { value: "inactive", label: "점검중" },
  { value: "suspended", label: "정지" },
  { value: "deleted", label: "삭제" },
];

const POST_FEEDBACK_FILTERS: { value: Filter; label: string }[] = [
  { value: "all", label: "전체" },
  { value: "urgent", label: "요청" },
  { value: "review", label: "확인" },
  { value: "active", label: "처리중" },
  { value: "approved", label: "처리완료" },
];

const POST_NOTICE_FILTERS: { value: Filter; label: string }[] = [
  { value: "all", label: "전체" },
  { value: "urgent", label: "긴급" },
  { value: "active", label: "활성" },
  { value: "approved", label: "종료" },
];

const SCHEDULE_FILTERS: { value: Filter; label: string }[] = [
  { value: "all", label: "전체" },
  { value: "shift", label: "시프트" },
  { value: "event", label: "이벤트" },
  { value: "leave", label: "휴가" },
  { value: "training", label: "교육" },
];

const MY_TODO_FILTERS: { value: Filter; label: string }[] = [
  { value: "all", label: "전체" },
  { value: "undone", label: "미완료" },
  { value: "done", label: "완료" },
  { value: "today", label: "오늘" },
  { value: "due-soon", label: "마감 임박" },
];

const COHORT_FILTERS: { value: Filter; label: string }[] = [
  { value: "all", label: "전체" },
  { value: "planned", label: "계획" },
  { value: "in_progress", label: "진행중" },
  { value: "completed", label: "완료" },
];

type Props = {
  title: string;
  data: { rows: ListRow[] };
  header?: React.ReactNode;
  /** team 등 특정 슬러그에서 전용 컬럼 사용. post는 도메인별 라벨 분리 */
  variant?:
    | "default"
    | "team"
    | "post-feedback"
    | "post-notice"
    | "schedule"
    | "my-todo"
    | "cohort";
  /** 저장 시 server persist (변경 후 revalidatePath 필요). undefined 면 client-only mock */
  onPersist?: (
    row: ListRow,
    isNew: boolean,
  ) => Promise<{ ok: boolean; error?: string }>;
  /** true면 신규/편집 등 변경 액션 hide (admin 외 사용자) */
  readOnly?: boolean;
  /** team variant — InspectorListBody 권한 select 노출 분기용 */
  currentUserPermission?: OperatorPermission | null;
  /** team 외 default variant에서도 신규 버튼 노출 (예: 게시판) */
  canCreate?: boolean;
  /** 신규 버튼 라벨 (기본: team='+ 신규 계정' / 그 외='+ 새 글') */
  createLabel?: string;
};

export function ListPattern({
  title,
  data,
  header,
  variant = "default",
  onPersist,
  readOnly = false,
  currentUserPermission = null,
  canCreate = false,
  createLabel,
}: Props) {
  const [rows, setRows] = useState<ListRow[]>(data.rows);
  const [filter, setFilter] = useState<Filter>("all");
  const inspector = useInspectorState<ListRow>();

  // filter='all'은 모든 row, 다른 filter는 status 매칭. team variant도 deleted 포함
  // (단, deleted row는 테이블에서 시각적으로 비활성화 처리 — opacity 낮춤).
  const filteredRows = filterRows(rows, filter, variant);
  const FILTERS =
    variant === "team"
      ? TEAM_FILTERS
      : variant === "post-feedback"
        ? POST_FEEDBACK_FILTERS
        : variant === "post-notice"
          ? POST_NOTICE_FILTERS
          : variant === "schedule"
            ? SCHEDULE_FILTERS
            : variant === "my-todo"
              ? MY_TODO_FILTERS
              : variant === "cohort"
                ? COHORT_FILTERS
                : DEFAULT_FILTERS;

  return (
    <>        {header}

      <div
        className={`flex flex-col transition-[padding] duration-[var(--drawer-ms)] ease-[var(--drawer-ease)] ${
          inspector.selected !== null ? "md:pr-[340px]" : ""
        }`}
      >
        <section className="p-7">
        <header className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div className="flex items-baseline gap-2">
            <h2 className="text-xl font-bold text-ink">{title}</h2>
            <span className="text-muted" aria-hidden>
              ·
            </span>
            <span className="text-sm text-vermilion">
              {filteredRows.length}건
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-1">
            {(variant === "team" || canCreate) && !readOnly && (
              <button
                type="button"
                onClick={() => {
                  let blank: ListRow;
                  if (variant === "team") {
                    blank = {
                      id: "",
                      name: "",
                      status: "active",
                      owner: "운영1팀",
                      meta: "매니저",
                      permission: "member",
                    };
                  } else if (
                    variant === "post-feedback" ||
                    variant === "post-notice"
                  ) {
                    blank = {
                      id: "",
                      name: "",
                      // feedback: 등록 시 '요청', notice: '활성'으로 시작
                      status: variant === "post-feedback" ? "urgent" : "active",
                      owner: "",
                      body: "",
                      author: "",
                    };
                  } else if (variant === "schedule") {
                    const now = new Date();
                    const inOneHour = new Date(now.getTime() + 60 * 60 * 1000);
                    blank = {
                      id: "",
                      name: "",
                      status: "active",
                      owner: "",
                      scheduleType: "event",
                      start_at: now.toISOString(),
                      end_at: inOneHour.toISOString(),
                      allDay: false,
                      assigneeEmail: null,
                    };
                  } else if (variant === "my-todo") {
                    blank = {
                      id: "",
                      name: "",
                      status: "active",
                      owner: "",
                      priority: "medium",
                      done: false,
                      dueAt: null,
                    };
                  } else if (variant === "cohort") {
                    const today = new Date().toISOString().slice(0, 10);
                    blank = {
                      id: "",
                      name: "",
                      status: "active",
                      owner: "",
                      traineeEmail: "",
                      mentorEmail: null,
                      startDate: today,
                      endDate: null,
                      cohortStatus: "planned",
                    };
                  } else {
                    blank = {
                      id: "",
                      name: "",
                      status: "active",
                      owner: "",
                    };
                  }
                  inspector.open(blank);
                  if (!inspector.editing) inspector.toggleEdit();
                }}
                className="mr-3 cursor-pointer border border-vermilion bg-vermilion px-3 py-1 text-xs font-medium text-cream hover:bg-vermilion-deep"
              >
                {createLabel ?? (variant === "team" ? "+ 신규 계정" : "+ 새 글")}
              </button>
            )}
            {FILTERS.map((f) => {
              const active = filter === f.value;
              const count =
                f.value === "all"
                  ? rows.length
                  : rows.filter((r) => r.status === f.value).length;
              return (
                <button
                  key={f.value}
                  type="button"
                  aria-label={f.label}
                  aria-pressed={active}
                  onClick={() => setFilter(f.value)}
                  className={`relative cursor-pointer border-none bg-transparent px-3 py-1 text-sm transition-colors ${
                    active
                      ? "font-bold text-ink"
                      : "text-muted hover:text-ink"
                  }`}
                >
                  {f.label} ({count})
                  {active && (
                    <span
                      aria-hidden
                      className="absolute bottom-[-1px] left-0 right-0 h-0.5 bg-vermilion"
                    />
                  )}
                </button>
              );
            })}
          </div>
        </header>

        <div className="overflow-x-auto">
          {variant === "team" ? (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line text-left text-xs uppercase tracking-[0.06em] text-muted">
                  <th className="px-3 py-2">팀</th>
                  <th className="px-3 py-2">이름</th>
                  <th className="px-3 py-2">직급</th>
                  <th className="px-3 py-2">이메일</th>
                  <th className="px-3 py-2">권한</th>
                  <th className="px-3 py-2">상태</th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-3 py-6 text-center text-muted">
                      데이터 없음
                    </td>
                  </tr>
                ) : (
                  filteredRows.map((row) => (
                    <tr
                      key={row.id}
                      onClick={() => inspector.open(row)}
                      className={`cursor-pointer border-b border-line-soft hover:bg-washi-raised ${
                        inspector.selected?.id === row.id ? "bg-washi-raised" : ""
                      } ${row.status === "deleted" ? "opacity-50 [&_td]:line-through" : ""}`}
                    >
                      <td className="px-3 py-2 text-sm text-ink-soft">{row.owner}</td>
                      <td className="px-3 py-2 font-medium text-ink">{row.name}</td>
                      <td className="px-3 py-2 text-sm text-ink-soft">{row.meta}</td>
                      <td className="px-3 py-2 font-mono text-xs text-muted">{row.id}</td>
                      <td className="px-3 py-2">
                        {row.permission ? (
                          <span
                            className={`inline-block px-2 py-0.5 text-xs ${PERMISSION_COLOR[row.permission]}`}
                          >
                            {PERMISSION_LABEL[row.permission]}
                          </span>
                        ) : (
                          <span className="text-xs text-muted">-</span>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        <span className={`inline-block px-2 py-0.5 text-xs ${STATUS_COLOR[row.status]}`}>
                          {STATUS_LABEL[row.status]}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          ) : variant === "post-feedback" || variant === "post-notice" ? (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line text-left text-xs uppercase tracking-[0.06em] text-muted">
                  <th className="px-3 py-2">ID</th>
                  <th className="px-3 py-2">제목</th>
                  <th className="px-3 py-2">상태</th>
                  <th className="px-3 py-2">등록자</th>
                  {variant === "post-feedback" && <th className="px-3 py-2">담당</th>}
                  <th className="px-3 py-2">작성일</th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.length === 0 ? (
                  <tr>
                    <td
                      colSpan={variant === "post-notice" ? 5 : 6}
                      className="px-3 py-6 text-center text-muted"
                    >
                      데이터 없음
                    </td>
                  </tr>
                ) : (
                  filteredRows.map((row) => (
                    <tr
                      key={row.id}
                      onClick={() => inspector.open(row)}
                      className={`cursor-pointer border-b border-line-soft hover:bg-washi-raised ${
                        inspector.selected?.id === row.id ? "bg-washi-raised" : ""
                      } ${row.status === "deleted" ? "opacity-50 [&_td]:line-through" : ""}`}
                    >
                      <td className="px-3 py-2 font-mono text-xs text-muted">{row.slug ?? row.id.slice(0, 8)}</td>
                      <td className="px-3 py-2 font-medium text-ink">{row.name}</td>
                      <td className="px-3 py-2">
                        <span className={`inline-block px-2 py-0.5 text-xs ${STATUS_COLOR[row.status]}`}>
                          {postStatusLabel(variant, row.status)}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-sm text-ink-soft">{row.author ?? "-"}</td>
                      {variant === "post-feedback" && (
                        <td className="px-3 py-2 text-sm text-ink-soft">{row.owner || "-"}</td>
                      )}
                      <td className="px-3 py-2 text-xs text-muted">{row.meta ?? "-"}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          ) : variant === "cohort" ? (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line text-left text-xs uppercase tracking-[0.06em] text-muted">
                  <th className="px-3 py-2">제목</th>
                  <th className="px-3 py-2">신입 / 사수</th>
                  <th className="px-3 py-2">기간</th>
                  <th className="px-3 py-2">상태</th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-3 py-6 text-center text-muted">
                      데이터 없음
                    </td>
                  </tr>
                ) : (
                  filteredRows.map((row) => (
                    <tr
                      key={row.id}
                      onClick={() => inspector.open(row)}
                      className={`cursor-pointer border-b border-line-soft hover:bg-washi-raised ${
                        inspector.selected?.id === row.id ? "bg-washi-raised" : ""
                      }`}
                    >
                      <td className="px-3 py-2 font-medium text-ink">{row.name}</td>
                      <td className="px-3 py-2 text-sm text-ink-soft">
                        {row.author || row.traineeEmail || "-"}
                        {row.owner && <> · 사수 {row.owner}</>}
                      </td>
                      <td className="px-3 py-2 text-sm text-ink-soft">
                        {formatCohortRange(row.startDate, row.endDate)}
                      </td>
                      <td className="px-3 py-2">
                        {row.cohortStatus && (
                          <span
                            className={`inline-block px-2 py-0.5 text-xs ${COHORT_STATUS_COLOR[row.cohortStatus]}`}
                          >
                            {COHORT_STATUS_LABEL[row.cohortStatus]}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          ) : variant === "my-todo" ? (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line text-left text-xs uppercase tracking-[0.06em] text-muted">
                  <th className="px-3 py-2">우선순위</th>
                  <th className="px-3 py-2">제목</th>
                  <th className="px-3 py-2">마감</th>
                  <th className="px-3 py-2">완료</th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-3 py-6 text-center text-muted">
                      데이터 없음
                    </td>
                  </tr>
                ) : (
                  filteredRows.map((row) => (
                    <tr
                      key={row.id}
                      onClick={() => inspector.open(row)}
                      className={`cursor-pointer border-b border-line-soft hover:bg-washi-raised ${
                        inspector.selected?.id === row.id ? "bg-washi-raised" : ""
                      } ${row.done ? "opacity-60 [&_td]:line-through" : ""}`}
                    >
                      <td className="px-3 py-2">
                        {row.priority && (
                          <span
                            className={`inline-block px-2 py-0.5 text-xs ${PRIORITY_COLOR[row.priority]}`}
                          >
                            {PRIORITY_LABEL[row.priority]}
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2 font-medium text-ink">{row.name}</td>
                      <td className="px-3 py-2 text-sm text-ink-soft">
                        {formatDueAt(row.dueAt)}
                      </td>
                      <td className="px-3 py-2">
                        <input
                          type="checkbox"
                          aria-label={`${row.name} 완료 토글`}
                          checked={row.done ?? false}
                          onClick={(e) => e.stopPropagation()}
                          onChange={async (e) => {
                            const nextDone = e.target.checked;
                            const nextRow: ListRow = {
                              ...row,
                              done: nextDone,
                              doneAt: nextDone ? new Date().toISOString() : null,
                            };
                            setRows((prev) =>
                              prev.map((r) => (r.id === row.id ? nextRow : r)),
                            );
                            if (onPersist) {
                              const result = await onPersist(nextRow, false);
                              if (!result.ok) {
                                setRows((prev) =>
                                  prev.map((r) => (r.id === row.id ? row : r)),
                                );
                                alert(`저장 실패: ${result.error ?? "알 수 없는 오류"}`);
                              }
                            }
                          }}
                          className="h-4 w-4 cursor-pointer accent-vermilion"
                        />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          ) : variant === "schedule" ? (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line text-left text-xs uppercase tracking-[0.06em] text-muted">
                  <th className="px-3 py-2">시각</th>
                  <th className="px-3 py-2">타입</th>
                  <th className="px-3 py-2">제목</th>
                  <th className="px-3 py-2">담당</th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-3 py-6 text-center text-muted">
                      데이터 없음
                    </td>
                  </tr>
                ) : (
                  filteredRows.map((row) => (
                    <tr
                      key={row.id}
                      onClick={() => inspector.open(row)}
                      className={`cursor-pointer border-b border-line-soft hover:bg-washi-raised ${
                        inspector.selected?.id === row.id ? "bg-washi-raised" : ""
                      }`}
                    >
                      <td className="px-3 py-2 text-sm text-ink">
                        {formatScheduleRange(row.start_at, row.end_at, row.allDay)}
                      </td>
                      <td className="px-3 py-2">
                        {row.scheduleType && (
                          <span
                            className={`inline-block px-2 py-0.5 text-xs ${SCHEDULE_TYPE_COLOR[row.scheduleType]}`}
                          >
                            {SCHEDULE_TYPE_LABEL[row.scheduleType]}
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2 font-medium text-ink">{row.name}</td>
                      <td className="px-3 py-2 text-sm text-ink-soft">
                        {row.owner || "팀 공통"}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line text-left text-xs uppercase tracking-[0.06em] text-muted">
                  <th className="px-3 py-2">ID</th>
                  <th className="px-3 py-2">이름</th>
                  <th className="px-3 py-2">상태</th>
                  <th className="px-3 py-2">담당</th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-3 py-6 text-center text-muted">
                      데이터 없음
                    </td>
                  </tr>
                ) : (
                  filteredRows.map((row) => (
                    <tr
                      key={row.id}
                      onClick={() => inspector.open(row)}
                      className={`cursor-pointer border-b border-line-soft hover:bg-washi-raised ${
                        inspector.selected?.id === row.id ? "bg-washi-raised" : ""
                      } ${row.status === "deleted" ? "opacity-50 [&_td]:line-through" : ""}`}
                    >
                      <td className="px-3 py-2 font-mono text-xs text-muted">{row.id}</td>
                      <td className="px-3 py-2 font-medium text-ink">{row.name}</td>
                      <td className="px-3 py-2">
                        <span className={`inline-block px-2 py-0.5 text-xs ${STATUS_COLOR[row.status]}`}>
                          {STATUS_LABEL[row.status]}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-sm text-ink-soft">{row.owner}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}
        </div>

        {!onPersist && (
          <p className="mt-3 text-xs text-muted">
            Demo · 실제 데이터 미연결
          </p>
        )}
        </section>
      </div>

      <InspectorPanel
        open={inspector.selected !== null}
        onClose={inspector.close}
      >
        {inspector.selected && (
          <>
            <header className="mb-6 border-b-2 border-ink pb-4">
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <p className="text-2xs uppercase tracking-[0.18em] text-vermilion">
                    인스펙터 · 항목 상세
                  </p>
                  <h3 className="text-xl font-bold tracking-[-0.01em] text-ink">
                    {inspector.selected.name}
                  </h3>
                  <p className="text-xs text-muted">
                    <span className="font-mono">{inspector.selected.id.toUpperCase()}</span>
                    {inspector.selected.meta && <> · {inspector.selected.meta}</>}
                    <> · PROD</>
                  </p>
                </div>
                <div
                  aria-hidden
                  className={`flex h-12 w-12 flex-shrink-0 flex-col items-center justify-center rounded-full text-[10px] leading-tight text-cream ${
                    STATUS_RING[inspector.selected.status]
                  }`}
                >
                  <span className="text-base">★</span>
                  <span>{STATUS_LABEL[inspector.selected.status]}</span>
                </div>
              </div>
              {!readOnly && (
                <div className="mt-2 flex justify-end">
                  <button
                    type="button"
                    onClick={inspector.toggleEdit}
                    className="cursor-pointer text-xs font-medium text-vermilion underline hover:text-vermilion-deep border-none bg-transparent p-0"
                  >
                    {inspector.editing ? "읽기 모드" : "구성 편집"}
                  </button>
                </div>
              )}
            </header>
            <InspectorListBody
              row={inspector.selected}
              editing={inspector.editing && !readOnly}
              variant={variant}
              currentUserPermission={currentUserPermission}
              onSave={async (next) => {
                const wasNew = !rows.some((r) => r.id === next.id) || next.id === "";
                // optimistic update
                setRows((prev) => {
                  return wasNew
                    ? [next, ...prev]
                    : prev.map((r) => (r.id === next.id ? next : r));
                });
                inspector.close();
                // server persist (있으면)
                if (onPersist) {
                  const result = await onPersist(next, wasNew);
                  if (!result.ok) {
                    // 실패 시 revert
                    setRows((prev) => {
                      return wasNew
                        ? prev.filter((r) => r.id !== next.id)
                        : prev.map((r) => (r.id === next.id ? r : r));
                    });
                    alert(`저장 실패: ${result.error ?? "알 수 없는 오류"}`);
                  }
                }
              }}
              onCancel={inspector.toggleEdit}
            />
          </>
        )}
      </InspectorPanel>
    </>
  );
}
