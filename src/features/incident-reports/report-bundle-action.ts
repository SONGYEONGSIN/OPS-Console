"use server";

import { getCurrentOperator } from "@/features/auth/queries";
import {
  getIncidentReportByIncidentId,
  listRecipientCandidates,
  resolveApprovalChain,
  type ApprovalChain,
} from "./queries";
import type { IncidentReportRow } from "./schemas";

export type IncidentReportBundle = {
  report: IncidentReportRow | null;
  recipients: Awaited<ReturnType<typeof listRecipientCandidates>>;
  approvalChain: ApprovalChain | null;
  /** 현재 로그인 사용자가 이 경위서의 결재자인지 (승인/반려 가드) */
  isApprover: boolean;
  /** 현재 사용자가 발송 가능한지 (작성자 또는 admin) */
  canSend: boolean;
};

const EMPTY_BUNDLE: IncidentReportBundle = {
  report: null,
  recipients: [],
  approvalChain: null,
  isApprover: false,
  canSend: false,
};

/**
 * 사고 인스펙터 경위서 탭에서 lazy 로드하는 번들.
 * 연결 경위서 + 발송 수신 후보 + 결재선을 한 번에 가져온다.
 */
export async function getIncidentReportBundle(
  incidentId: string,
): Promise<IncidentReportBundle> {
  const me = await getCurrentOperator();
  if (!me) return EMPTY_BUNDLE;

  const report = await getIncidentReportByIncidentId(incidentId);
  if (!report) return EMPTY_BUNDLE;

  const [recipients, approvalChain] = await Promise.all([
    listRecipientCandidates(report.recipient_university),
    resolveApprovalChain(report.author_email),
  ]);

  const isApprover = report.approver_email === me.email;
  const canSend =
    report.author_email === me.email || me.permission === "admin";

  return { report, recipients, approvalChain, isApprover, canSend };
}
