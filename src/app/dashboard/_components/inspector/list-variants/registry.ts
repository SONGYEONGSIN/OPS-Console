import { CohortView } from "./cohort/View";
import { CohortForm } from "./cohort/EditForm";
import { CohortTable } from "./cohort/Table";
import { COHORT_FILTERS, blankCohortRow } from "./cohort/filters";
import { ReceivablesView } from "./receivables/View";
import { ReceivablesForm } from "./receivables/EditForm";
import { ReceivablesTable } from "./receivables/Table";
import { RECEIVABLES_FILTERS } from "./receivables/filters";
import { AiWorkView } from "./ai-work/View";
import { AiWorkForm } from "./ai-work/EditForm";
import { AiWorkTable } from "./ai-work/Table";
import { blankAiWorkRow } from "./ai-work/filters";
import { AiTipsView } from "./ai-tips/View";
import { AiTipsForm } from "./ai-tips/EditForm";
import { AiTipsTable } from "./ai-tips/Table";
import { blankAiTipRow } from "./ai-tips/filters";
import { TeamView } from "./team/View";
import { TeamForm } from "./team/EditForm";
import { TeamTable } from "./team/Table";
import { TEAM_FILTERS, blankTeamRow } from "./team/filters";
import { PostTable } from "./post/Table";
import {
  POST_FEEDBACK_FILTERS,
  POST_NOTICE_FILTERS,
  blankPostRow,
} from "./post/filters";
import { ScheduleTable } from "./schedule/Table";
import { ScheduleForm } from "./schedule/EditForm";
import { SCHEDULE_FILTERS, blankScheduleRow } from "./schedule/filters";
import { MyTodoTable } from "./my-todo/Table";
import { MyTodoForm } from "./my-todo/EditForm";
import { MY_TODO_FILTERS, blankMyTodoRow } from "./my-todo/filters";
import { DefaultTable } from "./default/Table";
import { ServiceView } from "./default/View";
import { DefaultForm } from "./default/EditForm";
import { DEFAULT_FILTERS, blankDefaultRow } from "./default/filters";
import { BackupView } from "./backup/View";
import { BackupForm } from "./backup/EditForm";
import { BackupTable } from "./backup/Table";
import { BACKUP_FILTERS, blankBackupRow } from "./backup/filters";
import { ServicesView } from "./services/View";
import { ServicesForm } from "./services/EditForm";
import { ServicesTable } from "./services/Table";
import { SERVICES_FILTERS, blankServiceRow } from "./services/filters";
import { ContractsView } from "./contracts/View";
import { ContractsTable } from "./contracts/Table";
import { ContractsEditForm } from "./contracts/EditForm";
import { CONTRACTS_FILTERS } from "./contracts/filters";
import { ContactsView } from "./contacts/View";
import { ContactsForm } from "./contacts/EditForm";
import { ContactsTable } from "./contacts/Table";
import { CONTACTS_FILTERS, blankContactRow } from "./contacts/filters";
import { IncidentView } from "./incidents/View";
import { IncidentEditForm } from "./incidents/EditForm";
import { IncidentTable } from "./incidents/Table";
import { INCIDENT_FILTERS, blankIncidentRow } from "./incidents/filters";
import { HandoverTable } from "./handover/Table";
import { HandoverEditForm } from "./handover/EditForm";
import { HandoverView } from "./handover/View";
import type { ListRow } from "../../patterns/ListPattern";
import type { Variant, ViewProps, EditFormProps } from "./types";
import type { ComponentType } from "react";

type TableSlotProps = {
  rows: ListRow[];
  selectedId: string | null;
  onSelect: (row: ListRow) => void;
};

/** post variant Table은 variant prop 분기 필요 — 별도 슬롯 */
type PostTableProps = TableSlotProps & {
  variant: "post-feedback" | "post-notice";
};

/** my-todo variant Table은 체크박스 토글 콜백 필요 — 별도 슬롯 */
type MyTodoTableProps = TableSlotProps & {
  onToggleDone: (row: ListRow, nextDone: boolean) => Promise<void>;
};

type FilterOption = { value: string; label: string };

type RegistryEntry = {
  /** Inspector 읽기 모드 View — InspectorListBody가 dispatch (없으면 InspectorListBody 내부 처리) */
  View?: ComponentType<ViewProps>;
  /** Inspector 편집 모드 Form — 동일 */
  EditForm?: ComponentType<EditFormProps>;
  /** ListPattern variant 테이블 — registry에서 dispatcher로 라우팅 */
  Table?:
    | ComponentType<TableSlotProps>
    | ComponentType<PostTableProps>
    | ComponentType<MyTodoTableProps>;
  /** ListPattern variant 필터 옵션 — 미지정 시 default filter 사용 */
  Filters?: ReadonlyArray<FilterOption>;
  /** ListPattern '+ 새 항목' 신규 행 factory — 미지정 시 default blank 사용 */
  blank?: (opts?: { currentUserName?: string }) => ListRow;
};

/**
 * variant → 컴포넌트 매핑. import-time static binding으로 RSC 직렬화
 * 경계를 건너지 않는다 (inline factory 금지 — `(row) => <X/>` 형태 금지).
 *
 * 신규 variant 추가 시:
 *   1) list-variants/<name>/{View,EditForm,Table}.tsx + filters.ts 신설
 *   2) 이 파일에 한 줄 추가
 */
export const variantRegistry = {
  cohort: {
    View: CohortView,
    EditForm: CohortForm,
    Table: CohortTable,
    Filters: COHORT_FILTERS,
    blank: blankCohortRow,
  },
  receivables: {
    View: ReceivablesView,
    EditForm: ReceivablesForm,
    Table: ReceivablesTable,
    Filters: RECEIVABLES_FILTERS,
  },
  "ai-work": {
    View: AiWorkView,
    EditForm: AiWorkForm,
    Table: AiWorkTable,
    // chip 자체 비활성 — 전체/내 작업 토글은 ScopeChips(inlineFilters)로 처리
    Filters: [],
    blank: blankAiWorkRow,
  },
  "ai-tips": {
    View: AiTipsView,
    EditForm: AiTipsForm,
    Table: AiTipsTable,
    // chip 비활성 — ScopeChips(전체/내 TIP)로 토글
    Filters: [],
    blank: blankAiTipRow,
  },
  team: {
    View: TeamView,
    EditForm: TeamForm,
    Table: TeamTable,
    Filters: TEAM_FILTERS,
    blank: blankTeamRow,
  },
  "post-feedback": {
    Table: PostTable,
    Filters: POST_FEEDBACK_FILTERS,
    blank: () => blankPostRow("post-feedback"),
  },
  "post-notice": {
    Table: PostTable,
    Filters: POST_NOTICE_FILTERS,
    blank: () => blankPostRow("post-notice"),
  },
  schedule: {
    EditForm: ScheduleForm,
    Table: ScheduleTable,
    Filters: SCHEDULE_FILTERS,
    blank: blankScheduleRow,
  },
  "my-todo": {
    EditForm: MyTodoForm,
    Table: MyTodoTable,
    Filters: MY_TODO_FILTERS,
    blank: blankMyTodoRow,
  },
  default: {
    View: ServiceView,
    EditForm: DefaultForm,
    Table: DefaultTable,
    Filters: DEFAULT_FILTERS,
    blank: blankDefaultRow,
  },
  backup: {
    View: BackupView,
    EditForm: BackupForm,
    Table: BackupTable,
    Filters: BACKUP_FILTERS,
    blank: blankBackupRow,
  },
  services: {
    View: ServicesView,
    EditForm: ServicesForm,
    Table: ServicesTable,
    Filters: SERVICES_FILTERS,
    blank: blankServiceRow,
  },
  contracts: {
    View: ContractsView,
    EditForm: ContractsEditForm,
    Table: ContractsTable,
    Filters: CONTRACTS_FILTERS,
    // EditForm은 4 핵심 필드(operator/status/serviceActive/feeAmount) PATCH.
    // SharePoint workbook write — onPersist에서 updateContractField 4번 호출.
    // blank 없음 — 등록 흐름 없음 (시트에 직접 row 추가는 SharePoint에서)
  },
  contacts: {
    View: ContactsView,
    EditForm: ContactsForm,
    Table: ContactsTable,
    Filters: CONTACTS_FILTERS,
    blank: blankContactRow,
  },
  incidents: {
    View: IncidentView,
    EditForm: IncidentEditForm,
    Table: IncidentTable,
    Filters: INCIDENT_FILTERS,
    blank: blankIncidentRow,
  },
  handover: {
    View: HandoverView,
    EditForm: HandoverEditForm,
    Table: HandoverTable,
    // Filters 빈 배열 — 작성상태 chips는 페이지의 HandoverControls select가 담당 (page-size 한정
    // chip 카운트가 0/30 처럼 헷갈리는 표시를 피하기 위해 chips 자체 비표시).
    Filters: [],
    // blank 없음 — 신규 생성 흐름 없음 (services 행에 종속, 첫 저장 시 upsert)
  },
} as const satisfies Record<Variant, RegistryEntry>;
