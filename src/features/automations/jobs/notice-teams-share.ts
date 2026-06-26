import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendTeamsChatMessage } from "@/lib/microsoft/teams";
import type { AutomationRunResult } from "../types";

// 한 번에 보낼 최대 건수 — 백로그 폭주 방지. 남은 건은 다음 run에서 이어 처리.
const BATCH = 20;

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** 공지 → Teams 메시지 HTML. (순수) 제목/본문 escape, 줄바꿈→<br/>, 작성자 표기. */
export function buildNoticeMessage(n: {
  title: string;
  body?: string | null;
  author_label?: string | null;
}): string {
  const body = escapeHtml(n.body ?? "").replace(/\n/g, "<br/>");
  const who = n.author_label ? `<br/><br/>— ${escapeHtml(n.author_label)}` : "";
  return `<b>[공지] ${escapeHtml(n.title)}</b><br/><br/>${body}${who}`;
}

/**
 * 공지사항(posts.domain='notice') 중 미공유분을 Teams 그룹채팅에 발송한다.
 * - 채팅방: TEAMS_NOTICE_CHAT_ID (없으면 TEAMS_CHAT_ID 폴백)
 * - 발신 명의: TEAMS_NOTICE_SENDER (위임 토큰 필요)
 * - 멱등: 발송 성공한 공지만 notice_shared_at 기록 → 다음 run에서 제외. 실패분은 재시도.
 */
export async function runNoticeTeamsShare(): Promise<AutomationRunResult> {
  const chatId =
    process.env.TEAMS_NOTICE_CHAT_ID || process.env.TEAMS_CHAT_ID || "";
  const sender = process.env.TEAMS_NOTICE_SENDER || "";
  if (!chatId) {
    return {
      ok: true,
      message:
        "Teams 채팅방 미설정 (TEAMS_NOTICE_CHAT_ID/TEAMS_CHAT_ID) — 전송 생략",
    };
  }
  if (!sender) {
    return {
      ok: true,
      message: "Teams 발신자 미설정 (TEAMS_NOTICE_SENDER) — 전송 생략",
    };
  }

  // 공지일(announce_on)이 오늘(KST) 이하이거나 미설정(즉시)인 건만 공유 대상.
  const todayKst = new Date().toLocaleDateString("en-CA", {
    timeZone: "Asia/Seoul",
  });
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("posts")
    .select("id, title, body, owner_label, author_email")
    .eq("domain", "notice")
    .is("notice_shared_at", null)
    .or(`announce_on.is.null,announce_on.lte.${todayKst}`)
    .order("created_at", { ascending: true })
    .limit(BATCH);
  if (error) return { ok: false, message: `공지 조회 실패: ${error.message}` };

  const notices = data ?? [];
  if (notices.length === 0) {
    return {
      ok: true,
      message: "공유할 신규 공지 없음",
      details: { shared: 0 },
    };
  }

  let shared = 0;
  const errors: string[] = [];
  for (const n of notices) {
    try {
      const html = buildNoticeMessage({
        title: n.title as string,
        body: (n.body as string | null) ?? null,
        author_label:
          (n.owner_label as string | null) ?? (n.author_email as string),
      });
      await sendTeamsChatMessage({ operatorEmail: sender, chatId, html });
      const { error: upErr } = await admin
        .from("posts")
        .update({ notice_shared_at: new Date().toISOString() })
        .eq("id", n.id);
      if (upErr) errors.push(`표시 실패(${n.id}): ${upErr.message}`);
      else shared++;
    } catch (e) {
      errors.push(e instanceof Error ? e.message : String(e));
    }
  }

  return {
    ok: errors.length === 0,
    message: `${shared}건 Teams 공유${errors.length ? ` (${errors.length}건 오류)` : ""}`,
    details: { shared, errors: errors.length },
  };
}
