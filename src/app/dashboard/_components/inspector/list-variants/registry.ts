import { CohortView } from "./cohort/View";
import { CohortForm } from "./cohort/EditForm";
import { CohortTable } from "./cohort/Table";
import { COHORT_FILTERS, blankCohortRow } from "./cohort/filters";
import { ReceivablesView } from "./receivables/View";
import { ReceivablesForm } from "./receivables/EditForm";
import { AiWorkView } from "./ai-work/View";
import { AiWorkForm } from "./ai-work/EditForm";
import { TeamView } from "./team/View";
import { TeamForm } from "./team/EditForm";
import type { ListRow } from "../../patterns/ListPattern";
import type { Variant, ViewProps, EditFormProps } from "./types";
import type { ComponentType } from "react";

type TableSlotProps = {
  rows: ListRow[];
  selectedId: string | null;
  onSelect: (row: ListRow) => void;
};

type FilterOption = { value: string; label: string };

type RegistryEntry = {
  View: ComponentType<ViewProps>;
  EditForm: ComponentType<EditFormProps>;
  /** ListPattern variant 테이블 — registry에서 dispatcher로 라우팅 */
  Table?: ComponentType<TableSlotProps>;
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
  receivables: { View: ReceivablesView, EditForm: ReceivablesForm },
  "ai-work": { View: AiWorkView, EditForm: AiWorkForm },
  team: { View: TeamView, EditForm: TeamForm },
} as const satisfies Partial<Record<Variant, RegistryEntry>>;
