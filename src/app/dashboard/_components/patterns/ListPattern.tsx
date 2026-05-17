"use client";

import { useState } from "react";
import { InspectorPanel } from "../inspector/InspectorPanel";
import { InspectorListBody } from "../inspector/InspectorListBody";
import { useInspectorState } from "../inspector/useInspectorState";
import { variantRegistry } from "../inspector/list-variants/registry";
import { STATUS_LABEL, STATUS_RING } from "../inspector/list-variants/status";
import { applyMyTodoFilter } from "../inspector/list-variants/my-todo/filters";
import type { Variant } from "../inspector/list-variants/types";
import { type OperatorPermission } from "@/features/operators/schemas";

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
  /** onboarding cohort — 초대 메일 발송 시각 (ISO) */
  invitedAt?: string | null;
  /** onboarding cohort — 신입이 초대 수락한 시각 (ISO) */
  acceptedAt?: string | null;
  /** receivables — Excel row의 모든 columns + 편집용 메타데이터. */
  receivablesCells?: {
    headers: string[];
    textValues: string[];
    /** 편집 가능 셀의 현재 텍스트 (편집 폼 초기값) — headers 인덱스 기준 */
    editValues?: Record<number, string>;
    /** Excel sheet 1-based row 번호 (PATCH cell address) */
    sheetRowNumber?: number;
    /** 적요(피드백) 컬럼의 원본 인덱스 (PATCH cell letter 계산) */
    remarksColIdx?: number;
    /** 적요 컬럼의 valid 인덱스 (UI 렌더링 분기) */
    remarksHeaderIdx?: number;
    /** 적요 현재 텍스트 */
    remarks?: string;
    /** 입금예정일 컬럼의 원본 인덱스 (PATCH cell letter 계산) */
    dueDateColIdx?: number;
    /** 입금예정일 컬럼의 valid 인덱스 */
    dueDateHeaderIdx?: number;
    /** 입금예정일 현재 텍스트 */
    dueDate?: string;
    /** 학교담당자(이메일) 컬럼의 원본 인덱스 (PATCH cell letter 계산) */
    schoolOwnerColIdx?: number;
    /** 학교담당자 컬럼의 valid 인덱스 (UI 렌더링 분기) */
    schoolOwnerHeaderIdx?: number;
    /** 학교담당자 이메일 현재 텍스트 */
    schoolOwner?: string;
    /** 워크시트 이름 (PATCH URL) */
    worksheetName?: string;
  };
  /** ai-work 도메인 — AI 도구 enum (claude/chatgpt/...) */
  aiTool?: string;
  /** ai-work 도메인 — 카테고리 enum (code/doc/...) */
  category?: string;
  /** ai-work 도메인 — 작업 시작일 (YYYY-MM-DD) */
  workStartDate?: string;
  /** ai-work 도메인 — 작업 종료일 (YYYY-MM-DD). 단일 작업이면 start와 동일 */
  workEndDate?: string;
  /** ai-work 도메인 — 요약 markdown */
  summary?: string;
  /** ai-work 도메인 — 결과물 외부 링크 */
  outputUrl?: string | null;
  /** ai-work 도메인 — 재사용 프롬프트 */
  reusePrompt?: string | null;
  /** ai-work 도메인 — 절감 시간(시간) */
  savedHours?: number | null;
  /** ai-work 도메인 — 태그 배열 */
  tags?: string[];
  /** backup 도메인 — 백업자 이메일 */
  substituteEmail?: string;
  /** backup 도메인 — 백업자 이름 스냅샷 */
  substituteName?: string;
  /** backup 도메인 — 담당 서비스 id 배열 (services.id uuid). EditForm 입력 + create action 페이로드 */
  backupServices?: string[];
  /** backup 도메인 — 담당 서비스 join 상세. PR-3 서비스별 백업자 + PR-4 연락처/메모. View/Table/EditForm */
  backupServicesDetail?: {
    id: string;
    service_id: number;
    service_name: string;
    university_name: string;
    /** PR-3: 서비스별 백업자 — 미지정 시 backup_requests.substitute_*로 fallback */
    substitute_email?: string | null;
    substitute_name?: string | null;
    /** PR-4: 서비스별 연락처 chip 라벨 array */
    contacts: string[];
    /** PR-4: 서비스별 메모 (markdown) */
    note_md: string | null;
  }[];
  /** backup 도메인 — 휴가/외근 시작일 (YYYY-MM-DD, nullable) */
  leaveStartDate?: string | null;
  /** backup 도메인 — 휴가/외근 종료일 (YYYY-MM-DD, nullable) */
  leaveEndDate?: string | null;
  /** backup 도메인 — 메일 발송 상태 */
  mailStatus?: "pending" | "sent" | "mail_failed" | "dry_run";
  /** backup 도메인 — 메일 발송 시각 (ISO, nullable) */
  mailSentAt?: string | null;
  /** backup 도메인 — 메일 에러 메시지 (nullable) */
  mailError?: string | null;
  /** services 도메인 — 외부 PIMS 자연키 (bigint) */
  serviceIdNum?: number;
  /** services 도메인 — 접수구분 (공통원서/반응형원서/일반접수/일반원서) */
  applicationType?: string;
  /** services 도메인 — 지역 (18 광역시도) */
  region?: string;
  /** services 도메인 — 대학명 */
  universityName?: string;
  /** services 도메인 — 서비스명 (자유 텍스트) */
  serviceName?: string;
  /** services 도메인 — 대학구분 (4년제/2년제/...) */
  universityType?: string;
  /** services 도메인 — 운영자 이메일 (operators FK, nullable) */
  operatorEmail?: string | null;
  /** services 도메인 — 운영자 이름 스냅샷 (매칭 실패 fallback) */
  operatorName?: string | null;
  /** services 도메인 — 개발자 이메일 (operators FK, nullable) */
  developerEmail?: string | null;
  /** services 도메인 — 개발자 이름 스냅샷 */
  developerName?: string | null;
  /** services 도메인 — 작성 시작 (ISO, nullable) */
  writeStartAt?: string | null;
  /** services 도메인 — 작성 마감 (ISO, nullable) */
  writeEndAt?: string | null;
  /** services 도메인 — 결제 시작 (ISO, nullable) */
  payStartAt?: string | null;
  /** services 도메인 — 결제 마감 (ISO, nullable) */
  payEndAt?: string | null;
  /** services 도메인 — 단독여부 */
  solo?: boolean;
  /** services 도메인 — 출처 ('google_sheet_import' | 'folio_create') */
  source?: string;
  /** services 도메인 — import 시각 (ISO, nullable) */
  importedAt?: string | null;
  /** contracts 도메인 — 시트 dim ("4년제" | "전문대" | "초중고" | "대학원" | "기타") */
  contractSheet?: string;
  /** contracts 도메인 — 넘버링 (D-1-01 등) */
  numbering?: string;
  /** contracts 도메인 — 계약진행현황 text (계약완료 / 공란) */
  contractStatus?: string;
  /** contracts 도메인 — 서비스여부 (Y / 공란) */
  serviceActive?: string;
  /** contracts 도메인 — 수수료(VAT포함) display text */
  feeAmount?: string;
  /** contracts 도메인 — 시트별 전체 컬럼 (헤더 → 값). 인스펙터 raw view */
  contractRaw?: Record<string, string>;
  /** contacts 도메인 — 활성화 ("재직" | "타부서 이동") */
  customerActive?: string;
  /** contacts 도메인 — 직함 (자유) */
  jobTitle?: string | null;
  /** contacts 도메인 — 소속부서 */
  departmentName?: string | null;
  /** contacts 도메인 — 직책 (실무자 / 관리자) */
  jobRole?: string | null;
  /** contacts 도메인 — 관리 등급 (A / B / C / D) */
  managementGrade?: string | null;
  /** contacts 도메인 — 관계 등급 (우호적 / ...) */
  relationshipGrade?: string | null;
  /** contacts 도메인 — 연락처 휴대폰 */
  contactPhone?: string | null;
  /** contacts 도메인 — 연락처 내선 */
  contactExt?: string | null;
  /** contacts 도메인 — 이메일 */
  contactEmail?: string | null;
  /** incidents 도메인 — 학년도 (예: 2027 = 2026.03~2027.02) */
  incidentYear?: number;
  /** incidents — 대학명 (자유 텍스트) */
  incidentUniversityName?: string;
  /** incidents — 구분 */
  incidentAppType?: "공통원서" | "일반원서" | "공공원서" | "PIMS";
  /** incidents — 카테고리 자유 텍스트 (결제 / 원서작성 / 사이트 / 경쟁률 / 기타) */
  incidentCategory?: string;
  /** incidents — 발생일자 (YYYY-MM-DD, nullable) */
  incidentOccurredDate?: string | null;
  /** incidents — 처리일자 (YYYY-MM-DD, nullable) */
  incidentResolvedDate?: string | null;
  /** incidents — 사고제목 */
  incidentTitle?: string;
  /** incidents — 본문 4섹션 (markdown) */
  incidentCauseSummary?: string | null;
  incidentRootCause?: string | null;
  incidentResolution?: string | null;
  incidentPrevention?: string | null;
  /** incidents — 담당부서 */
  incidentDepartment?: "운영부-운영1팀" | "운영부-운영2팀";
  /** incidents — 담당자 (본인 자동) */
  incidentAssigneeEmail?: string;
  incidentAssigneeName?: string;
  /** incidents — 보고자 (부서별 고정 매핑) */
  incidentReporterEmail?: string;
  incidentReporterName?: string;
  /** incidents — 현재상황 */
  incidentStatus?: "미처리" | "처리중" | "처리완료" | "보류";
  /** handover — service 번호 (display) */
  handoverServiceNumber?: number;
  /** handover — 작성상태 (record 없으면 undefined) */
  handoverStatus?: "draft" | "ready" | "published";
  /** handover — 14 sub-field (인스펙터 EditForm 초기값) */
  handoverContractInfoMd?: string | null;
  handoverContractDataMd?: string | null;
  handoverWorkBasicMd?: string | null;
  handoverWorkGeneratorMd?: string | null;
  handoverWorkSiteMd?: string | null;
  handoverWorkOutputMd?: string | null;
  handoverWorkRateMd?: string | null;
  handoverWorkFileMd?: string | null;
  handoverWorkEtcMd?: string | null;
  handoverPaymentFeeMd?: string | null;
  handoverPaymentInvoiceMd?: string | null;
  handoverSchoolContactMd?: string | null;
  handoverDocsMd?: string | null;
  handoverNotesMd?: string | null;
  /** contracts — 시트명 (PATCH 시 필요) */
  contractsSheet?: string;
  /** contracts — 4 필드 셀 주소 (PATCH 시 사용, null이면 헤더 미발견) */
  contractsCellOperator?: string | null;
  contractsCellStatus?: string | null;
  contractsCellServiceActive?: string | null;
  contractsCellFeeAmount?: string | null;
};

export type ScheduleType = NonNullable<ListRow["scheduleType"]>;
export type TodoPriority = NonNullable<ListRow["priority"]>;
export type MyTodoFilter = "done" | "undone" | "today" | "due-soon";
export type CohortStatus = NonNullable<ListRow["cohortStatus"]>;

export type Filter =
  | ListRow["status"]
  | "all"
  | ScheduleType
  | MyTodoFilter
  | CohortStatus;

/**
 * variant별 필터 적용. 단순 분기만 ListPattern에 유지 (my-todo는 복잡한 시간 비교
 * 로직이라 my-todo/filters.ts의 applyMyTodoFilter로 위임).
 */
function filterRows(
  rows: ListRow[],
  filter: Filter,
  variant: string,
): ListRow[] {
  if (filter === "all") return rows;
  if (variant === "schedule")
    return rows.filter((r) => r.scheduleType === filter);
  if (variant === "my-todo") return applyMyTodoFilter(rows, filter);
  if (variant === "cohort")
    return rows.filter((r) => r.cohortStatus === filter);
  return rows.filter((r) => r.status === filter);
}

type Props = {
  title: string;
  data: { rows: ListRow[] };
  header?: React.ReactNode;
  /** team 등 특정 슬러그에서 전용 컬럼 사용. post는 도메인별 라벨 분리 */
  variant?: Variant;
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
  /** cohort variant — 초대 메일 발송 (admin only). InspectorListBody로 전달. */
  onInvite?: (id: string) => Promise<{ ok: boolean; error?: string }>;
  /** receivables variant — 인스펙터의 독려 메일 발송이 dry-run 모드인지 (env 기반, server에서 결정). */
  receivablesMailDryRun?: boolean;
  /** ai-work variant — 신규 행 생성 시 owner 자동 채움용 (현재 운영자 이름) */
  currentUserName?: string;
  /** backup variant — 백업자 후보 (active operators, 본인 제외) */
  backupOperators?: { email: string; name: string }[];
  /** backup variant — 담당 서비스 후보 (services 카탈로그 light fields). EditForm multi-select. */
  backupServiceCandidates?: {
    id: string;
    service_id: number;
    service_name: string;
    university_name: string;
  }[];
  /** backup variant — 대학 연락처 후보 */
  backupContactCandidates?: {
    id: string;
    customer_name: string;
    university_name: string;
  }[];
  /** contacts variant — 대학명 자동완성 후보 */
  universityNameSuggestions?: readonly string[];
  /** services variant — 운영자·개발자 후보 (operators 마스터, active). EditForm select. */
  servicesOperators?: { email: string; name: string }[];
  /** services variant — 대학명 → 학교키·다음 시퀀스 매핑 (EditForm 검색 combobox + 자동 service_id 부여) */
  servicesUniversityKeys?: {
    universityName: string;
    key: number;
    nextSeq: number;
  }[];
  /** incidents variant — 대학명 자동완성 후보 (services.university_name distinct) */
  incidentUniversityNameSuggestions?: readonly string[];
  /** incidents variant — 카테고리 자동완성 후보 (datalist) */
  incidentCategorySuggestions?: readonly string[];
  /** contracts variant — 계약진행현황 / 서비스여부 datalist 옵션 */
  contractsStatusOptions?: readonly string[];
  contractsServiceActiveOptions?: readonly string[];
  /** filter chip 영역에 추가로 렌더할 인라인 요소 (예: services 변경 — '내 서비스' 칩) */
  inlineFilters?: React.ReactNode;
  /**
   * header(PageHeader) 아래 + section(목록) 위에 렌더할 검색/필터 영역.
   * inspector 열림 시 pr-340 패딩이 적용돼 가려지지 않음. header는 풀 너비 유지.
   */
  controlsRow?: React.ReactNode;
  /** 테이블 하단에 렌더할 요소 (예: 페이지네이션) */
  footer?: React.ReactNode;
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
  onInvite,
  receivablesMailDryRun = true,
  currentUserName,
  backupOperators,
  backupServiceCandidates,
  backupContactCandidates,
  universityNameSuggestions,
  servicesOperators,
  servicesUniversityKeys,
  incidentUniversityNameSuggestions,
  incidentCategorySuggestions,
  contractsStatusOptions,
  contractsServiceActiveOptions,
  controlsRow,
  inlineFilters,
  footer,
}: Props) {
  const [rows, setRows] = useState<ListRow[]>(data.rows);
  const [filter, setFilter] = useState<Filter>("all");
  const inspector = useInspectorState<ListRow>();

  // row 클릭 시 worklog 기록 + 인스펙터 열기 (fire-and-forget)
  function handleRowSelect(row: ListRow) {
    fetch("/api/worklog/log", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        level: "DEBUG",
        domain: variant,
        action: "row_click",
        target_type: "list_row",
        target_id: row.id,
        target_name: row.name,
        msg: `row 선택 — ${row.name}`,
      }),
      keepalive: true,
    }).catch(() => {});
    inspector.open(row);
  }

  // server에서 새 rows 도착하면 client state 동기화 (덮어쓰기).
  // React 공식 "Storing information from previous renders" 패턴 — useState 비교.
  // useEffect+setState 또는 ref-in-render는 React Compiler 룰에 차단되어 채택 X.
  const [prevDataRows, setPrevDataRows] = useState(data.rows);
  if (prevDataRows !== data.rows) {
    setPrevDataRows(data.rows);
    setRows(data.rows);
  }

  // filter='all'은 모든 row, 다른 filter는 status 매칭. team variant도 deleted 포함
  // (단, deleted row는 테이블에서 시각적으로 비활성화 처리 — opacity 낮춤).
  const filteredRows = filterRows(rows, filter, variant);
  const variantEntry = variantRegistry[variant as keyof typeof variantRegistry];
  const entryFilters =
    variantEntry && "Filters" in variantEntry ? variantEntry.Filters : null;
  const FILTERS = (entryFilters ?? variantRegistry.default.Filters) as {
    value: Filter;
    label: string;
  }[];

  /**
   * variant별 Table 컴포넌트 렌더링.
   * post/my-todo는 추가 prop 시그니처가 달라 별도 분기 — 나머지는 base TableProps cast.
   */
  function renderVariantTable() {
    if (variant === "post-feedback" || variant === "post-notice") {
      const PostTable = variantRegistry[variant].Table;
      return (
        <PostTable
          variant={variant}
          rows={filteredRows}
          selectedId={inspector.selected?.id ?? null}
          onSelect={handleRowSelect}
        />
      );
    }
    if (variant === "my-todo") {
      const MyTodoTable = variantRegistry["my-todo"].Table;
      return (
        <MyTodoTable
          rows={filteredRows}
          selectedId={inspector.selected?.id ?? null}
          onSelect={handleRowSelect}
          onToggleDone={async (row, nextDone) => {
            const nextRow: ListRow = {
              ...row,
              done: nextDone,
              doneAt: nextDone ? new Date().toISOString() : null,
            };
            setRows((prev) => prev.map((r) => (r.id === row.id ? nextRow : r)));
            if (onPersist) {
              const result = await onPersist(nextRow, false);
              if (!result.ok) {
                setRows((prev) => prev.map((r) => (r.id === row.id ? row : r)));
                alert(`저장 실패: ${result.error ?? "알 수 없는 오류"}`);
              }
            }
          }}
        />
      );
    }
    // 단순 TableProps만 받는 variant들 (cohort/receivables/ai-work/team/schedule/default)
    const Table = variantEntry?.Table ?? variantRegistry.default.Table;
    const Comp = Table as React.ComponentType<{
      rows: ListRow[];
      selectedId: string | null;
      onSelect: (row: ListRow) => void;
    }>;
    return (
      <Comp
        rows={filteredRows}
        selectedId={inspector.selected?.id ?? null}
        onSelect={handleRowSelect}
      />
    );
  }

  return (
    <>
      {header}
      <div
        className={`flex flex-col transition-[padding] duration-[var(--drawer-ms)] ease-[var(--drawer-ease)] ${
          inspector.selected !== null ? "md:pr-[340px]" : ""
        }`}
      >
        {controlsRow}
        <section className="p-7">
          <header className="mb-4 flex flex-wrap items-end justify-between gap-3">
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <div className="flex items-baseline gap-2">
                <h2
                  className={`${variant === "cohort" ? "text-sm font-medium" : "text-xl font-bold"} text-ink`}
                >
                  {title}
                </h2>
                <span className="text-muted" aria-hidden>
                  ·
                </span>
                <span className="text-sm text-vermilion">
                  {filteredRows.length}건
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-1">
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
                {inlineFilters}
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-1">
              {(variant === "team" || canCreate) && !readOnly && (
                <button
                  type="button"
                  onClick={() => {
                    const entryBlank =
                      variantEntry && "blank" in variantEntry
                        ? variantEntry.blank
                        : null;
                    const blank: ListRow =
                      entryBlank?.({ currentUserName }) ??
                      variantRegistry.default.blank();
                    inspector.open(blank);
                    if (!inspector.editing) inspector.toggleEdit();
                  }}
                  className="cursor-pointer border border-vermilion bg-vermilion px-3 py-1 text-xs font-medium text-cream hover:bg-vermilion-deep"
                >
                  {createLabel ??
                    (variant === "team" ? "+ 신규 계정" : "+ 새 글")}
                </button>
              )}
            </div>
          </header>

          <div className="overflow-x-auto">{renderVariantTable()}</div>

          {footer}

          {!onPersist && (
            <p className="mt-3 text-xs text-muted">Demo · 실제 데이터 미연결</p>
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
                    <span className="font-mono">
                      {inspector.selected.id.toUpperCase()}
                    </span>
                    {inspector.selected.meta && (
                      <> · {inspector.selected.meta}</>
                    )}
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
              onInvite={onInvite}
              receivablesMailDryRun={receivablesMailDryRun}
              backupOperators={backupOperators}
              backupServiceCandidates={backupServiceCandidates}
              backupContactCandidates={backupContactCandidates}
              universityNameSuggestions={universityNameSuggestions}
              servicesOperators={servicesOperators}
              servicesUniversityKeys={servicesUniversityKeys}
              incidentUniversityNameSuggestions={incidentUniversityNameSuggestions}
              incidentCategorySuggestions={incidentCategorySuggestions}
              contractsStatusOptions={contractsStatusOptions}
              contractsServiceActiveOptions={contractsServiceActiveOptions}
              onSave={async (next) => {
                const wasNew =
                  !rows.some((r) => r.id === next.id) || next.id === "";
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
