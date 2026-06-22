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
  /** incidents variant — 본인 작성건 삭제 권한 판정용 (member는 본인 건만) */
  currentUserEmail?: string | null;
  /** incidents variant — 담당부서 자동 고정용 (operators.team) */
  currentUserTeam?: string | null;
  /** cohort variant — 초대 메일 발송/재초대 (admin only). server action wrapper. */
  onInvite?: (id: string) => Promise<{ ok: boolean; error?: string }>;
  /** cohort variant — 인스펙터 체크리스트 토글 (trainee 본인 || admin). server action wrapper. */
  onChecklistToggle?: (input: {
    cohort_id: string;
    section_key: string;
    item_key: string;
    checked: boolean;
  }) => Promise<{ ok: boolean; error?: string }>;
  /** mailbox variant — 회신 발송 server action wrapper. */
  onMailReply?: (
    messageId: string,
    editedBody: string,
  ) => Promise<{ ok: boolean; error?: string }>;
  /** receivables variant — 적요 셀 PATCH server action. */
  onUpdateRemarks?: (
    row: ListRow,
    newText: string,
  ) => Promise<{ ok: boolean; error?: string }>;
  /** receivables variant — 독려 메일 발송이 dry-run 모드인지 (env 기반). */
  receivablesMailDryRun?: boolean;
  /** backup variant — 백업자 후보 (active operators, 본인 제외) */
  backupOperators?: { email: string; name: string }[];
  /** backup variant — 담당 서비스 후보 (services 카탈로그 light fields) */
  backupServiceCandidates?: {
    id: string;
    service_id: number;
    service_name: string;
    university_name: string;
  }[];
  /** backup variant — 대학 연락처 후보 (contacts 마스터). PR-5: email/phone 추가. ext(내선) 포함 */
  backupContactCandidates?: {
    id: string;
    customer_name: string;
    university_name: string;
    email: string | null;
    phone: string | null;
    ext: string | null;
  }[];
  /** contacts variant — 대학명 자동완성 후보 */
  universityNameSuggestions?: readonly string[];
  /** services variant — 운영자·개발자 후보 (operators 마스터) */
  servicesOperators?: { email: string; name: string }[];
  /** services variant — 대학명 → 학교키·다음 시퀀스 매핑 */
  servicesUniversityKeys?: {
    universityName: string;
    key: number;
    nextSeq: number;
  }[];
  /** incidents variant — 대학명 자동완성 후보 (services.university_name distinct) */
  incidentUniversityNameSuggestions?: readonly string[];
  /** incidents variant — 서비스 후보 (대학명 + 서비스명) */
  incidentServiceOptions?: readonly { university: string; name: string }[];
  /** incidents variant — 카테고리 자동완성 후보 (datalist) */
  incidentCategorySuggestions?: readonly string[];
  /** contracts variant — 계약진행현황 / 서비스여부 datalist 옵션 */
  contractsStatusOptions?: readonly string[];
  contractsServiceActiveOptions?: readonly string[];
  /** handover variant — 복제 대상 서비스 후보 + 복제 콜백 */
  handoverServiceCandidates?: {
    id: string;
    serviceId: number;
    universityName: string;
    serviceName: string;
    hasRecord: boolean;
  }[];
  onCopyHandover?: (
    fromServiceId: string,
    toServiceIds: string[],
  ) => Promise<{ ok: boolean; error?: string; copiedCount?: number }>;
  /** post-feedback/post-notice — 등록자를 본인 계정으로 고정 (현재 로그인 displayName) */
  currentUserName?: string;
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
  currentUserEmail = null,
  currentUserTeam = null,
  onInvite,
  onChecklistToggle,
  onMailReply,
  onUpdateRemarks,
  receivablesMailDryRun = true,
  backupOperators,
  backupServiceCandidates,
  backupContactCandidates,
  universityNameSuggestions,
  servicesOperators,
  servicesUniversityKeys,
  incidentUniversityNameSuggestions,
  incidentServiceOptions,
  incidentCategorySuggestions,
  contractsStatusOptions,
  contractsServiceActiveOptions,
  handoverServiceCandidates,
  onCopyHandover,
  currentUserName,
}: Props) {
  const [draft, setDraft] = useState<ListRow>(row);

  if (!editing) {
    return (
      <ViewMode
        row={row}
        variant={variant}
        currentUserPermission={currentUserPermission}
        receivablesMailDryRun={receivablesMailDryRun}
        onChecklistToggle={onChecklistToggle}
        onMailReply={onMailReply}
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
        currentUserName={currentUserName}
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
        currentUserEmail={currentUserEmail}
        currentUserTeam={currentUserTeam}
        currentUserName={currentUserName}
        onInvite={onInvite}
        onUpdateRemarks={onUpdateRemarks}
        backupOperators={backupOperators}
        backupServiceCandidates={backupServiceCandidates}
        backupContactCandidates={backupContactCandidates}
        universityNameSuggestions={universityNameSuggestions}
        servicesOperators={servicesOperators}
        servicesUniversityKeys={servicesUniversityKeys}
        incidentUniversityNameSuggestions={incidentUniversityNameSuggestions}
        incidentServiceOptions={incidentServiceOptions}
        incidentCategorySuggestions={incidentCategorySuggestions}
        contractsStatusOptions={contractsStatusOptions}
        contractsServiceActiveOptions={contractsServiceActiveOptions}
        handoverServiceCandidates={handoverServiceCandidates}
        onCopyHandover={onCopyHandover}
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
  onChecklistToggle,
  onMailReply,
}: {
  row: ListRow;
  variant: Variant;
  currentUserPermission?: OperatorPermission | null;
  receivablesMailDryRun?: boolean;
  onChecklistToggle?: (input: {
    cohort_id: string;
    section_key: string;
    item_key: string;
    checked: boolean;
  }) => Promise<{ ok: boolean; error?: string }>;
  onMailReply?: (
    messageId: string,
    editedBody: string,
  ) => Promise<{ ok: boolean; error?: string }>;
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
        onChecklistToggle={onChecklistToggle}
        onMailReply={onMailReply}
      />
    );
  }
  return null;
}
