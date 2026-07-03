import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendTeamsChatMessage } from "@/lib/microsoft/teams";
import { listContracts } from "@/features/contracts/queries";
import { CONTRACT_SHEETS } from "@/features/contracts/schemas";
import type { AutomationRunResult } from "../types";
import {
  aggregateContracts,
  nextWeekdayRange,
  groupScheduleInRange,
  buildBriefingHtml,
  type BriefEvent,
  type ClosingItem,
} from "./team-briefing-build";

const UPCOMING_WINDOW_DAYS = 7;

function kstTodayYmd(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Seoul" });
}
function addDaysYmd(ymd: string, n: number): string {
  const [y, m, d] = ymd.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + n);
  return dt.toISOString().slice(0, 10);
}

/**
 * 팀 보고 브리핑 — 매주 금요일 Teams 그룹채팅에 계약진행/팀업무 현황 스냅샷 발송.
 * cron 실행(세션 없음)이라 Supabase는 admin client로 직접 조회한다.
 * 방: TEAMS_CHAT_ID(차주보고 방과 동일) → 없으면 TEAMS_NOTICE_CHAT_ID 폴백.
 * 발신: TEAMS_BRIEFING_SENDER → TEAMS_NOTICE_SENDER → 없으면 기본값 ys1114@jinhakapply.com.
 * 드라이런: TEAM_BRIEFING_DRY_RUN 또는 MAIL_DRY_RUN = "true" → 외부 호출 없이 집계 결과만.
 */
const BRIEFING_SENDER_DEFAULT = "ys1114@jinhakapply.com";

export async function runTeamBriefing(): Promise<AutomationRunResult> {
  const chatId =
    process.env.TEAMS_CHAT_ID || process.env.TEAMS_NOTICE_CHAT_ID || "";
  const sender =
    process.env.TEAMS_BRIEFING_SENDER ||
    process.env.TEAMS_NOTICE_SENDER ||
    BRIEFING_SENDER_DEFAULT;
  const dryRun =
    process.env.TEAM_BRIEFING_DRY_RUN === "true" ||
    process.env.MAIL_DRY_RUN === "true";

  // 발송 시에만 방 env 필요 — 드라이런은 집계까지 수행해 결과를 확인할 수 있게 한다.
  if (!dryRun && !chatId) {
    return {
      ok: true,
      message:
        "Teams 채팅방 미설정 (TEAMS_CHAT_ID/TEAMS_NOTICE_CHAT_ID) — 전송 생략",
    };
  }

  const todayYmd = kstTodayYmd();
  const weekRange = nextWeekdayRange(todayYmd);
  const limitYmd = addDaysYmd(todayYmd, UPCOMING_WINDOW_DAYS);

  // 1. 계약진행 현황 — SharePoint Excel(Graph, cron-safe).
  //    계약 테이블/사이드바 카운트와 동일하게 서비스여부 'Y' 계약만 집계.
  const { rows: contractRows } = await listContracts();
  const activeContractRows = contractRows.filter(
    (r) => (r.serviceActive ?? "").trim().toUpperCase() === "Y",
  );
  const contracts = aggregateContracts(
    activeContractRows.map((r) => ({ sheet: r.sheet, status: r.status })),
    CONTRACT_SHEETS,
  );

  const admin = createAdminClient();

  // 2. 팀업무 현황 — 다음주(월~금) 일정
  const { data: evData, error: evErr } = await admin
    .from("schedule_events")
    .select("type, title, start_at, end_at, all_day")
    .gte("start_at", `${weekRange.startYmd}T00:00:00+09:00`)
    .lte("start_at", `${weekRange.endYmd}T23:59:59+09:00`)
    .order("start_at", { ascending: true });
  if (evErr) return { ok: false, message: `일정 조회 실패: ${evErr.message}` };
  const schedule = groupScheduleInRange(
    (evData ?? []) as BriefEvent[],
    weekRange.startYmd,
    weekRange.endYmd,
  );

  // 3. 서비스 마감 임박 — closing_services 결제마감(pay_end_at) D-7 이내(팀 전체)
  const { data: clData, error: clErr } = await admin
    .from("closing_services")
    .select("university_name, service_name, pay_end_at, operator_name")
    .not("pay_end_at", "is", null)
    .gte("pay_end_at", `${todayYmd}T00:00:00+09:00`)
    .lte("pay_end_at", `${limitYmd}T23:59:59+09:00`)
    .order("pay_end_at", { ascending: true });
  if (clErr) return { ok: false, message: `마감 조회 실패: ${clErr.message}` };
  const closing = (clData ?? []) as ClosingItem[];

  const html = buildBriefingHtml({
    dateLabel: todayYmd,
    contracts,
    weekRange,
    schedule,
    closing,
  });

  const details = {
    contractsDone: contracts.totalDone,
    contractsOngoing: contracts.totalOngoing,
    scheduleGroups: schedule.length,
    closing: closing.length,
  };

  if (dryRun) {
    return {
      ok: true,
      message: `DRY-RUN — 브리핑 생성(발송 생략). 계약 완료 ${contracts.totalDone}·진행 ${contracts.totalOngoing}, 마감임박 ${closing.length}건`,
      details,
    };
  }

  try {
    await sendTeamsChatMessage({ operatorEmail: sender, chatId, html });
  } catch (e) {
    return {
      ok: false,
      message: `Teams 발송 실패: ${e instanceof Error ? e.message : String(e)}`,
    };
  }
  return {
    ok: true,
    message: `팀 보고 브리핑 발송 완료 (마감임박 ${closing.length}건)`,
    details,
  };
}
