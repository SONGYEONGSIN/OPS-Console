import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendTeamsChatMessage } from "@/lib/microsoft/teams";
import { listContracts } from "@/features/contracts/queries";
import { briefingUrl } from "@/features/team-briefings/url";
import { getPublishedCelebrationKeys } from "@/features/team-briefings/queries";
import { CONTRACT_SHEETS } from "@/features/contracts/schemas";
import type { AutomationRunResult } from "../types";
import {
  aggregateContracts,
  nextWeekdayRange,
  groupScheduleInRange,
  buildBriefingTeaserHtml,
  summarizeAiWork,
  summarizeTips,
  summarizeInsights,
  upcomingAnniversaries,
  upcomingBirthdays,
  excludeSeenCelebrations,
  pickAlbum,
  pickFeatureIntros,
  type BriefEvent,
  type BriefingImages,
  type BriefingMedia,
  type BriefingPayload,
  type ClosingItem,
} from "./team-briefing-build";

const UPCOMING_WINDOW_DAYS = 7;
const AI_WINDOW_DAYS = 7;

function kstTodayYmd(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Seoul" });
}
function kstWeekdayShort(): string {
  return new Date().toLocaleDateString("ko-KR", {
    timeZone: "Asia/Seoul",
    weekday: "short",
  });
}
function addDaysYmd(ymd: string, n: number): string {
  const [y, m, d] = ymd.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + n);
  return dt.toISOString().slice(0, 10);
}

/**
 * 팀 뉴스레터 — 주간 데이터 집계(buildBriefingData) + 뉴스레터 발행/Teams 티저(publishBriefing).
 * 정규 발행 경로: 상시 맥 launchd(scripts/team-briefing/publish-local.mjs)가
 *   GET /api/team-briefing/draft → claude -p 스토리 생성 → POST /api/team-briefing/publish.
 * registry의 runTeamBriefing은 수동 실행/폴백용(스토리 없이 발행) — 자동 스케줄은 로컬로 이전.
 * 방: 공지와 동일한 TEAMS_NOTICE_CHAT_ID(공지 방)만 사용 — 차주보고 방 폴백 없음.
 * 발신: TEAMS_BRIEFING_SENDER → TEAMS_NOTICE_SENDER → 기본값 ys1114@jinhakapply.com.
 * 드라이런: TEAM_BRIEFING_DRY_RUN 또는 MAIL_DRY_RUN = "true" → 외부 호출 없이 집계 결과만.
 */
const BRIEFING_SENDER_DEFAULT = "ys1114@jinhakapply.com";

const IMAGE_EXT = /\.(jpe?g|png|webp|gif)$/i;
const VIDEO_EXT = /\.(mp4|webm|mov)$/i;
const IMAGE_WINDOW_DAYS = 7;

/**
 * Storage newsletter 버킷의 최근 업로드 폴더(YYYYMMDD ≥ 발행일-7일)에서
 * 사진·영상을 수집. captions.json이 있으면 파일별 캡션 매핑.
 * 업로드는 scripts/team-briefing/upload-assets.mjs 참조.
 */
async function collectNewsletterImages(
  admin: ReturnType<typeof createAdminClient>,
  todayYmd: string,
): Promise<BriefingImages | undefined> {
  const sinceCompact = addDaysYmd(todayYmd, -IMAGE_WINDOW_DAYS).replaceAll(
    "-",
    "",
  );
  const storage = admin.storage.from("newsletter");
  const { data: rootEntries, error } = await storage.list("", { limit: 100 });
  if (error || !rootEntries) return undefined;

  const gallery: BriefingMedia[] = [];
  const videos: BriefingMedia[] = [];
  const folders = rootEntries
    .filter((e) => /^\d{8}$/.test(e.name) && e.name >= sinceCompact)
    .map((e) => e.name)
    .sort();

  for (const folder of folders) {
    const { data: files } = await storage.list(folder, { limit: 100 });
    if (!files) continue;

    let captions: Record<string, string> = {};
    if (files.some((f) => f.name === "captions.json")) {
      const { data: blob } = await storage.download(`${folder}/captions.json`);
      if (blob) {
        try {
          captions = JSON.parse(await blob.text()) as Record<string, string>;
        } catch {
          captions = {};
        }
      }
    }

    for (const f of files) {
      const path = `${folder}/${f.name}`;
      const { data: pub } = storage.getPublicUrl(path);
      const media: BriefingMedia = {
        src: pub.publicUrl,
        caption: captions[f.name],
      };
      if (IMAGE_EXT.test(f.name)) gallery.push(media);
      else if (VIDEO_EXT.test(f.name)) videos.push(media);
    }
  }

  return pickAlbum(gallery, videos);
}

export type BriefingDetails = {
  contractsDone: number;
  contractsOngoing: number;
  scheduleGroups: number;
  closing: number;
  aiWorkCount: number;
  aiWorkSavedHours: number;
  tipsNew: number;
  tipsTotal: number;
  insightsNew: number;
};

/** 주간 브리핑 데이터 집계 — 계약/차주 일정/마감 임박/AI 활용/근속 마일스톤. */
export async function buildBriefingData(): Promise<
  | { ok: true; payload: BriefingPayload; details: BriefingDetails }
  | { ok: false; message: string }
> {
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

  // 4. AI 활용 — 내 AI 작업 + TIP 공유, 최근 7일(등록일 기준).
  //    author_email은 노출하지 않고 operators 이름으로 변환(미등록은 @ 앞부분).
  const sinceIso = `${addDaysYmd(todayYmd, -AI_WINDOW_DAYS)}T00:00:00+09:00`;

  const { data: opData, error: opErr } = await admin
    .from("operators")
    .select("email, name, hired_at, birth_date")
    .order("email", { ascending: true });
  if (opErr)
    return { ok: false, message: `운영자 조회 실패: ${opErr.message}` };
  const operators = (opData ?? []) as {
    email: string;
    name: string;
    hired_at?: string;
    birth_date?: string | null;
  }[];
  const nameByEmail = new Map(operators.map((o) => [o.email, o.name]));
  const displayName = (email: string) =>
    nameByEmail.get(email) ?? email.split("@")[0];

  // 근속 마일스톤 + 생일 — 윈도우가 주간 발행보다 넓어 겹치므로,
  // 이미 발행된 호에 실린 건은 제외해 같은 기념일이 반복 노출되지 않게 한다.
  const seenCelebrations = await getPublishedCelebrationKeys();
  const milestones = excludeSeenCelebrations(
    upcomingAnniversaries(
      operators
        .filter((o) => o.hired_at)
        .map((o) => ({ name: o.name, hired_at: o.hired_at! })),
      todayYmd,
    ),
    "ms",
    seenCelebrations,
  );
  const birthdays = excludeSeenCelebrations(
    upcomingBirthdays(
      operators
        .filter((o) => o.birth_date)
        .map((o) => ({ name: o.name, birth_date: o.birth_date! })),
      todayYmd,
    ),
    "bd",
    seenCelebrations,
  );

  // 사진·영상 — Storage newsletter 버킷의 최근 업로드 폴더(YYYYMMDD) 스캔.
  // 부가 콘텐츠라 실패해도 발행은 계속 (이미지 없이).
  let images: BriefingImages | undefined;
  try {
    images = await collectNewsletterImages(admin, todayYmd);
  } catch {
    images = undefined;
  }

  type AwRow = {
    title: string;
    ai_tool: string;
    author_email: string;
    saved_hours: number | null;
  };
  const mapAw = (rows: AwRow[] | null) =>
    (rows ?? []).map((w) => ({
      title: w.title,
      ai_tool: w.ai_tool,
      author_name: displayName(w.author_email),
      saved_hours: w.saved_hours,
    }));
  const AW_SELECT = "title, ai_tool, author_email, saved_hours";
  const { data: awNew, error: awErr } = await admin
    .from("ai_work")
    .select(AW_SELECT)
    .gte("created_at", sinceIso)
    .order("created_at", { ascending: false });
  if (awErr)
    return { ok: false, message: `AI 작업 조회 실패: ${awErr.message}` };
  // 목록은 최근 누적에서 채운다(신규 0이어도 최근 작업 노출). 3 = AI_LIST_MAX.
  const { data: awRecent } = await admin
    .from("ai_work")
    .select(AW_SELECT)
    .order("created_at", { ascending: false })
    .limit(3);
  const { count: aiWorkTotal, error: awtErr } = await admin
    .from("ai_work")
    .select("id", { count: "exact", head: true });
  if (awtErr)
    return { ok: false, message: `AI 작업 누적 조회 실패: ${awtErr.message}` };
  const aiWork = summarizeAiWork(
    mapAw(awNew as AwRow[] | null),
    mapAw(awRecent as AwRow[] | null),
    aiWorkTotal ?? 0,
  );

  type TipRow = { title: string; ai_tool: string; author_email: string };
  const mapTip = (rows: TipRow[] | null) =>
    (rows ?? []).map((t) => ({
      title: t.title,
      ai_tool: t.ai_tool,
      author_name: displayName(t.author_email),
    }));
  const TIP_SELECT = "title, ai_tool, author_email";
  const { data: tipNewData, error: tnErr } = await admin
    .from("ai_tips")
    .select(TIP_SELECT)
    .gte("created_at", sinceIso)
    .order("created_at", { ascending: false });
  if (tnErr) return { ok: false, message: `TIP 조회 실패: ${tnErr.message}` };
  // 목록은 최근 누적에서 채운다(신규 3건 미만이어도). 3 = AI_LIST_MAX.
  const { data: tipRecent } = await admin
    .from("ai_tips")
    .select(TIP_SELECT)
    .order("created_at", { ascending: false })
    .limit(3);
  const { data: tipAllData, error: taErr } = await admin
    .from("ai_tips")
    .select("id");
  if (taErr)
    return { ok: false, message: `TIP 누적 조회 실패: ${taErr.message}` };
  const tips = summarizeTips(
    mapTip(tipNewData as TipRow[] | null),
    mapTip(tipRecent as TipRow[] | null),
    (tipAllData ?? []).length,
  );

  const { data: ivData, error: ivErr } = await admin
    .from("insight_videos")
    .select("title, channel_title, view_count, video_id")
    .gte("collected_at", sinceIso)
    .order("collected_at", { ascending: false });
  if (ivErr)
    return { ok: false, message: `인사이트 조회 실패: ${ivErr.message}` };
  const insights = summarizeInsights(
    (
      (ivData ?? []) as {
        title: string;
        channel_title: string;
        view_count: number | null;
        video_id: string;
      }[]
    ).map((v) => ({
      title: v.title,
      channel_title: v.channel_title,
      view_count: v.view_count,
      url: `https://www.youtube.com/watch?v=${encodeURIComponent(v.video_id)}`,
    })),
  );

  // 이번 주 기능 소개 — 다음 발행 호수 기준 순환 선택.
  // 초안은 세지 않는다(발행분만) — 초안이 있는 상태로 재생성해도 같은 호수를 유지해야 한다.
  const { count: publishedCount } = await admin
    .from("team_briefings")
    .select("id", { count: "exact", head: true })
    .eq("status", "published");
  const featureIntros = pickFeatureIntros((publishedCount ?? 0) + 1);

  const payload: BriefingPayload = {
    dateLabel: `${todayYmd} (${kstWeekdayShort()})`,
    contracts,
    weekRange,
    schedule,
    closing,
    aiWork,
    tips,
    insights,
    milestones,
    birthdays,
    featureIntros,
    images,
  };

  return {
    ok: true,
    payload,
    details: {
      contractsDone: contracts.totalDone,
      contractsOngoing: contracts.totalOngoing,
      scheduleGroups: schedule.length,
      closing: closing.length,
      aiWorkCount: aiWork.count,
      aiWorkSavedHours: aiWork.savedHours,
      tipsNew: tips.newCount,
      tipsTotal: tips.totalCount,
      insightsNew: insights.newCount,
    },
  };
}

/** 발신자 — 초안 알림·그룹 티저 공통. */
function briefingSender(): string {
  return (
    process.env.TEAMS_BRIEFING_SENDER ||
    process.env.TEAMS_NOTICE_SENDER ||
    BRIEFING_SENDER_DEFAULT
  );
}

/** 발행분 수 + 1 — 초안은 세지 않는다(호수가 밀리지 않도록). */
async function nextIssueNo(
  admin: ReturnType<typeof createAdminClient>,
): Promise<{ ok: true; value: number } | { ok: false; message: string }> {
  const { count, error } = await admin
    .from("team_briefings")
    .select("id", { count: "exact", head: true })
    .eq("status", "published");
  if (error)
    return { ok: false, message: `브리핑 호수 조회 실패: ${error.message}` };
  return { ok: true, value: (count ?? 0) + 1 };
}

/**
 * 초안 저장 — 사람이 내용을 확인할 수 있도록 발행 전 단계에 세워둔다.
 * 그룹채팅 티저는 보내지 않는다. 본인 Teams 채팅으로만 미리보기 링크를 알린다.
 * 초안은 1건만 유지 — 새 초안이 이전 초안을 대체한다.
 */
export async function stageBriefingDraft(
  payload: BriefingPayload,
): Promise<
  | { ok: true; url: string; nextIssueNo: number; notified: boolean }
  | { ok: false; message: string }
> {
  const admin = createAdminClient();
  const issue = await nextIssueNo(admin);
  if (!issue.ok) return issue;

  const { error: delErr } = await admin
    .from("team_briefings")
    .delete()
    .eq("status", "draft");
  if (delErr)
    return { ok: false, message: `이전 초안 정리 실패: ${delErr.message}` };

  const shareToken = crypto.randomUUID().replace(/-/g, "");
  const { error: insErr } = await admin.from("team_briefings").insert({
    issue_no: issue.value,
    briefing_date: kstTodayYmd(),
    payload,
    share_token: shareToken,
    status: "draft",
  });
  if (insErr)
    return { ok: false, message: `초안 저장 실패: ${insErr.message}` };

  const url = briefingUrl(shareToken);
  const draftChatId = process.env.TEAMS_BRIEFING_DRAFT_CHAT_ID || "";
  if (!draftChatId)
    return { ok: true, url, nextIssueNo: issue.value, notified: false };

  try {
    await sendTeamsChatMessage({
      operatorEmail: briefingSender(),
      chatId: draftChatId,
      html: `<p><b>[운영부 상황실]</b> 주간 브리핑 초안 #${issue.value}호가 준비됐습니다.</p><p><a href="${url}">미리보기 열기</a></p><p>확인 후 자동화 페이지에서 발행하세요.</p>`,
    });
  } catch {
    // 알림 실패로 초안을 버리지 않는다. 호출부가 notified:false를 이력에 남긴다.
    return { ok: true, url, nextIssueNo: issue.value, notified: false };
  }
  return { ok: true, url, nextIssueNo: issue.value, notified: true };
}

/**
 * 초안 발행 확정 — 호수를 확정하고 그룹채팅 티저를 발송한다.
 * share_token은 초안 때 부여한 값을 유지한다(확인한 링크 = 팀에 나가는 링크).
 * 방 미설정이면 발행만 하고 발송은 생략(sent: false).
 */
export async function publishStagedDraft(
  draftId: string,
): Promise<
  | { ok: true; issueNo: number; url: string; sent: boolean }
  | { ok: false; message: string }
> {
  const admin = createAdminClient();
  const { data: draft } = await admin
    .from("team_briefings")
    .select("id, issue_no, share_token, payload")
    .eq("id", draftId)
    .maybeSingle();
  if (!draft) return { ok: false, message: "발행할 초안이 없습니다" };

  const issue = await nextIssueNo(admin);
  if (!issue.ok) return issue;

  const { error: updErr } = await admin
    .from("team_briefings")
    .update({
      status: "published",
      published_at: new Date().toISOString(),
      issue_no: issue.value,
    })
    .eq("id", draftId);
  if (updErr)
    return { ok: false, message: `발행 처리 실패: ${updErr.message}` };

  const issueNo = issue.value;
  const payload = draft.payload as BriefingPayload;
  const url = briefingUrl(draft.share_token as string);
  const chatId = process.env.TEAMS_NOTICE_CHAT_ID || "";
  if (!chatId) return { ok: true, issueNo, url, sent: false };

  const sender = briefingSender();
  const html = buildBriefingTeaserHtml({
    issueNo,
    dateLabel: payload.dateLabel,
    headline: payload.story?.headline,
    teaser: payload.story?.teaser,
    contracts: payload.contracts,
    closing: payload.closing,
    aiWork: payload.aiWork,
    tips: payload.tips,
    url,
  });
  try {
    await sendTeamsChatMessage({ operatorEmail: sender, chatId, html });
  } catch (e) {
    return {
      ok: false,
      message: `발행됨(#${issueNo}) · Teams 발송 실패: ${e instanceof Error ? e.message : String(e)}`,
    };
  }
  return { ok: true, issueNo, url, sent: true };
}

/**
 * registry 수동 실행/폴백 — 스토리 없이 집계→초안 저장. 정규 초안은 로컬 스케줄러.
 * 어느 경로로도 사람 확인 없이 그룹채팅에 나가지 않도록 여기서도 초안까지만 만든다.
 */
export async function runTeamBriefing(): Promise<AutomationRunResult> {
  const dryRun =
    process.env.TEAM_BRIEFING_DRY_RUN === "true" ||
    process.env.MAIL_DRY_RUN === "true";

  const built = await buildBriefingData();
  if (!built.ok) return { ok: false, message: built.message };
  const { payload, details } = built;

  if (dryRun) {
    return {
      ok: true,
      message: `DRY-RUN — 브리핑 생성(초안 저장 생략). 계약 완료 ${details.contractsDone}·진행 ${details.contractsOngoing}, 마감임박 ${details.closing}건, AI작업 ${details.aiWorkCount}건·TIP 신규 ${details.tipsNew}건`,
      details,
    };
  }

  const staged = await stageBriefingDraft(payload);
  if (!staged.ok) return { ok: false, message: staged.message };
  return {
    ok: true,
    message: `초안 #${staged.nextIssueNo}호 생성 — 발행 대기 (마감임박 ${details.closing}건)${staged.notified ? "" : " · 본인 Teams 알림 미설정"}`,
    details: { ...details, issueNo: staged.nextIssueNo },
  };
}
