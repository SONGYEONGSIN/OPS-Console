import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  ensureOneOnOneChat,
  sendTeamsChatMessage,
} from "@/lib/microsoft/teams";
import type {
  RatioAuditIngest,
  RatioFinding,
  RatioLinkError,
} from "./schemas";
import { isExcluded, loadRatioAuditExceptions } from "./exceptions";
import {
  buildAdminRatioAuditHtml,
  buildOperatorPageCheckHtml,
  buildOperatorRatioAuditHtml,
  groupFindingsByOperator,
  groupLinkErrorsByOperator,
} from "./summary";

/**
 * 점검 결과 발송 — 담당 운영자 개인 1:1 채팅으로 본인 담당 건만 보낸다.
 *
 * 그룹방 일괄 발송은 "내 건이 뭔지" 각자 찾아야 해서 아무도 안 고친다. 대신
 * 담당자에게 직접 보내되, 닿지 않은 것(담당 미상·발송 실패·링크오류·건너뜀)은
 * 관리자 채팅으로 모아 알린다 — 조용히 묻히는 경로를 만들지 않는다.
 *
 * 발신자는 팀 브리핑과 같은 계정(위임 토큰 보유 운영자)이다.
 */

// 팀 브리핑과 동일 발신 계정 (team-briefing.ts BRIEFING_SENDER_DEFAULT).
const SENDER_DEFAULT = "ys1114@jinhakapply.com";
/**
 * 관리자 취합 기본 채널 = 발신자 본인 노트 채팅.
 *
 * `48:notes`는 Teams가 계정마다 갖는 고정 self 채팅 id다(팀 브리핑 초안 알림과 동일).
 * self 채팅은 Graph로 생성할 수 없어(2인 필수) 이 id를 쓴다. 기본값을 두는 이유는
 * env 하나 빠뜨렸다고 '담당 미상·발송 실패'가 아무 데도 안 남는 상황을 막기 위함이다.
 */
const ADMIN_CHAT_DEFAULT = "48:notes";

export type RatioDispatchResult = {
  /** 개인 채팅 발송에 성공한 운영자 수 */
  sent: number;
  failed: { operatorName: string; reason: string }[];
  /** 담당 미상 + operators 미매칭 이상 건수 */
  unassignedCount: number;
  /** 예외 등록으로 발송에서 제외한 건수 */
  excludedCount: number;
  adminNotified: boolean;
  adminError?: string;
};

function sender(): string {
  return (
    process.env.TEAMS_RATIO_AUDIT_SENDER ||
    process.env.TEAMS_BRIEFING_SENDER ||
    SENDER_DEFAULT
  );
}

/** 운영자 이름 → 메일. Moa 표기(closing_services.operator_name)와 대조한다. */
async function operatorEmails(): Promise<Map<string, string>> {
  const admin = createAdminClient();
  const { data, error } = await admin.from("operators").select("name, email");
  if (error)
    throw new Error(`[ratio-audit] 운영자 조회 실패: ${error.message}`);
  return new Map(
    (data ?? [])
      .filter((r) => r.name && r.email)
      .map((r) => [r.name as string, r.email as string]),
  );
}

function reasonOf(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

export async function dispatchRatioAudit(
  input: RatioAuditIngest,
): Promise<RatioDispatchResult> {
  const nothingToReport =
    input.findings.length === 0 &&
    input.linkErrors.length === 0 &&
    input.skipped.length === 0;
  if (nothingToReport) {
    return {
      sent: 0,
      failed: [],
      unassignedCount: 0,
      excludedCount: 0,
      adminNotified: false,
    };
  }

  const from = sender();
  const emails = await operatorEmails();
  const isPage = input.kind === "page";

  // 합의된 정상(예: 마감 후 수동 공개)은 발송에서 뺀다 — 판정 결과에는 남아 있다.
  const exceptions = await loadRatioAuditExceptions();
  const findings = input.findings.filter(
    (f) => !isExcluded(exceptions, f.serviceId, f.seq),
  );
  const linkErrors = input.linkErrors.filter(
    (e) => !isExcluded(exceptions, e.serviceId, 1),
  );
  const excludedCount =
    input.findings.length -
    findings.length +
    (input.linkErrors.length - linkErrors.length);

  // 점검 종류에 따라 '담당자에게 보낼 것'이 다르다 — 스케줄은 이상 건, 페이지는 링크오류.
  const groups: { operatorName: string; html: string }[] = isPage
    ? groupLinkErrorsByOperator(linkErrors).map((g) => ({
        operatorName: g.operatorName,
        html: buildOperatorPageCheckHtml({
          operatorName: g.operatorName,
          linkErrors: g.linkErrors,
        }),
      }))
    : groupFindingsByOperator(findings).map((g) => ({
        operatorName: g.operatorName,
        html: buildOperatorRatioAuditHtml({
          operatorName: g.operatorName,
          findings: g.findings,
        }),
      }));

  const failed: RatioDispatchResult["failed"] = [];
  const unassigned: RatioFinding[] = [];
  const unassignedLinks: RatioLinkError[] = [];
  let sent = 0;

  // 순차 발송 — 대상이 20명 내외라 병렬로 Graph 스로틀을 살 이유가 없다.
  for (const group of groups) {
    const email = emails.get(group.operatorName);
    if (!email) {
      if (isPage) {
        unassignedLinks.push(
          ...linkErrors.filter((e) => e.operatorName === group.operatorName),
        );
      } else {
        unassigned.push(
          ...findings.filter((f) => f.operatorName === group.operatorName),
        );
      }
      continue;
    }
    try {
      const chatId = await ensureOneOnOneChat({
        operatorEmail: from,
        targetEmail: email,
      });
      await sendTeamsChatMessage({
        operatorEmail: from,
        chatId,
        html: group.html,
      });
      sent += 1;
    } catch (e) {
      // 한 명이 실패해도 나머지는 계속 보낸다. 실패는 관리자 메시지로 드러낸다.
      failed.push({ operatorName: group.operatorName, reason: reasonOf(e) });
    }
  }

  const unassignedTotal = unassigned.length + unassignedLinks.length;
  const adminChatId =
    process.env.TEAMS_RATIO_AUDIT_ADMIN_CHAT_ID || ADMIN_CHAT_DEFAULT;
  try {
    await sendTeamsChatMessage({
      operatorEmail: from,
      chatId: adminChatId,
      html: buildAdminRatioAuditHtml({
        input,
        unassigned,
        unassignedLinks,
        sentCount: sent,
        excludedCount,
        failed,
      }),
    });
    return {
      sent,
      failed,
      unassignedCount: unassignedTotal,
      excludedCount,
      adminNotified: true,
    };
  } catch (e) {
    return {
      sent,
      failed,
      unassignedCount: unassignedTotal,
      excludedCount,
      adminNotified: false,
      adminError: reasonOf(e),
    };
  }
}
