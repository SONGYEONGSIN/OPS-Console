import "server-only";
import { sendTeamsChatMessage } from "@/lib/microsoft/teams";

/**
 * 자동화 보고 발송 — 발신 대상 해석 + Teams 전달.
 *
 * 발신자는 경쟁률 점검·팀 뉴스레터와 같은 계정(위임 토큰 보유 운영자)이고, 기본 채팅은
 * 그 계정의 노트 채팅이다. `48:notes`는 Teams가 계정마다 갖는 고정 self 채팅 id로,
 * self 채팅은 Graph로 생성할 수 없어(2인 필수) 이 id를 그대로 쓴다.
 */

const SENDER_DEFAULT = "ys1114@jinhakapply.com";
const CHAT_DEFAULT = "48:notes";

export function reportSender(): string {
  return (
    process.env.TEAMS_AUTOMATION_SENDER ||
    process.env.TEAMS_BRIEFING_SENDER ||
    SENDER_DEFAULT
  );
}

export function reportChatId(): string {
  return process.env.TEAMS_AUTOMATION_CHAT_ID || CHAT_DEFAULT;
}

export type ReportSendResult = {
  sent: boolean;
  dryRun?: true;
  error?: string;
};

/**
 * 보고 1건 발송. **예외를 올리지 않는다** — 보고는 관측용이라, 발송 실패가 잡 실행
 * 결과를 뒤집으면 안 된다. 실패는 반환값으로만 드러낸다.
 */
export async function sendAutomationReport(
  html: string,
): Promise<ReportSendResult> {
  if (process.env.AUTOMATION_REPORT_DRY_RUN === "true") {
    return { sent: false, dryRun: true };
  }
  try {
    await sendTeamsChatMessage({
      operatorEmail: reportSender(),
      chatId: reportChatId(),
      html,
    });
    return { sent: true };
  } catch (e) {
    return { sent: false, error: e instanceof Error ? e.message : String(e) };
  }
}
