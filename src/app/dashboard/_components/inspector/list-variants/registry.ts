import { CohortView } from "./cohort/View";
import { CohortForm } from "./cohort/EditForm";
import { ReceivablesView } from "./receivables/View";
import { ReceivablesForm } from "./receivables/EditForm";
import type { Variant, ViewProps, EditFormProps } from "./types";
import type { ComponentType } from "react";

/**
 * variant → 컴포넌트 매핑. import-time static binding으로 RSC 직렬화
 * 경계를 건너지 않는다 (inline factory 금지 — `(row) => <X/>` 형태 금지).
 *
 * 신규 variant 추가 시:
 *   1) list-variants/<name>/{View,EditForm}.tsx 신설
 *   2) 이 파일에 한 줄 추가
 */
export const variantRegistry = {
  cohort: { View: CohortView, EditForm: CohortForm },
  receivables: { View: ReceivablesView, EditForm: ReceivablesForm },
} as const satisfies Partial<
  Record<
    Variant,
    {
      View: ComponentType<ViewProps>;
      EditForm: ComponentType<EditFormProps>;
    }
  >
>;
