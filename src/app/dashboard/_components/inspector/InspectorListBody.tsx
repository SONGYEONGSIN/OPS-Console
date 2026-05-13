"use client";

import { useState } from "react";
import type { ListRow } from "../patterns/ListPattern";
import type { OperatorPermission } from "@/features/operators/schemas";
import { variantRegistry } from "./list-variants/registry";
import { PostView } from "./list-variants/post/View";
import { PostForm } from "./list-variants/post/EditForm";

import type { Variant } from "./list-variants/types";

type Props = {
  row: ListRow;
  editing: boolean;
  onSave: (next: ListRow) => void;
  onCancel: () => void;
  variant?: Variant;
  /** team variant — 권한 select admin만 노출하기 위한 컨텍스트 */
  currentUserPermission?: OperatorPermission | null;
  /** cohort variant — 초대 메일 발송/재초대 (admin only). server action wrapper. */
  onInvite?: (id: string) => Promise<{ ok: boolean; error?: string }>;
  /** receivables variant — 적요 셀 PATCH server action. */
  onUpdateRemarks?: (
    row: ListRow,
    newText: string,
  ) => Promise<{ ok: boolean; error?: string }>;
  /** receivables variant — 독려 메일 발송이 dry-run 모드인지 (env 기반). */
  receivablesMailDryRun?: boolean;
};

/**
 * InspectorListBody — list pattern row 인스펙터 본문 dispatcher.
 *
 * variant별 View/EditForm은 `list-variants/<variant>/{View,EditForm}.tsx` 에서 정의.
 * registry.ts가 import-time static binding으로 라우팅 (RSC 직렬화 호환).
 * post-feedback/post-notice는 variant prop이 필요해 별도 분기로 직접 dispatch.
 */
export function InspectorListBody({
  row,
  editing,
  onSave,
  onCancel,
  variant = "default",
  currentUserPermission = null,
  onInvite,
  onUpdateRemarks,
  receivablesMailDryRun = true,
}: Props) {
  const [draft, setDraft] = useState<ListRow>(row);

  if (!editing) {
    return (
      <ViewMode
        row={row}
        variant={variant}
        currentUserPermission={currentUserPermission}
        receivablesMailDryRun={receivablesMailDryRun}
      />
    );
  }

  if (variant === "post-feedback" || variant === "post-notice") {
    return (
      <PostForm
        row={draft}
        variant={variant}
        setRow={setDraft}
        onSave={onSave}
        onCancel={onCancel}
      />
    );
  }

  const entry = variantRegistry[variant as keyof typeof variantRegistry];
  if (entry && "EditForm" in entry && entry.EditForm) {
    const EditForm = entry.EditForm;
    return (
      <EditForm
        row={draft}
        setRow={setDraft}
        onSave={onSave}
        onCancel={onCancel}
        currentUserPermission={currentUserPermission}
        onInvite={onInvite}
        onUpdateRemarks={onUpdateRemarks}
      />
    );
  }

  return null;
}

function ViewMode({
  row,
  variant,
  currentUserPermission = null,
  receivablesMailDryRun = true,
}: {
  row: ListRow;
  variant: Variant;
  currentUserPermission?: OperatorPermission | null;
  receivablesMailDryRun?: boolean;
}) {
  if (variant === "post-feedback" || variant === "post-notice") {
    return <PostView row={row} variant={variant} />;
  }
  const entry = variantRegistry[variant as keyof typeof variantRegistry];
  if (entry && "View" in entry && entry.View) {
    const View = entry.View;
    return (
      <View
        row={row}
        currentUserPermission={currentUserPermission}
        receivablesMailDryRun={receivablesMailDryRun}
      />
    );
  }
  return null;
}
