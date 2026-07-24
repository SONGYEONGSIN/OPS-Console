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
  buildBriefingTeaserHtml,
  summarizeAiWork,
  summarizeTips,
  summarizeInsights,
  upcomingAnniversaries,
  upcomingBirthdays,
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
 * 팀 보고 브리핑 — 주간 데이터 집계(buildBriefingData) + 뉴스레터 발행/Teams 티저(publishBriefing).
 * 정규 발행 경로: 상시 맥 launchd(scripts/team-briefing/publish-local.mjs)가
 *   GET /api/team-briefing/draft → claude -p 스토리 생성 → POST /api/team-briefing/publish.
 * registry의 runTeamBriefing은 수동 실행/폴백용(스토리 없이 발행) — 자동 스케줄은 로컬로 이전.
 * 방: 공지와 동일한 TEAMS_NOTICE_CHAT_ID(공지 방)만 사용 — 차주보고 방 폴백 없음.
 * 발신: TEAMS_BRIEFING_SENDER → TEAMS_NOTICE_SENDER → 기본값 ys1114@jinhakapply.com.
 * 드라이런: TEAM_BRIEFING_DRY_RUN 또는 MAIL_DRY_RUN = "true" → 외부 호출 없이 집계 결과만.
 */
const BRIEFING_SENDER_DEFAULT = "ys1114@jinhakapply.com";

/** 뉴스레터 공유 링크 베이스 — posts/handover 메일 링크와 동일 관례. */
function baseUrl(): string {
  return (
    process.env.NEXT_PUBLIC_APP_URL ??
    process.env.FOLIO_BASE_URL ??
    "http://localhost:3000"
  );
}

const IMAGE_EXT = /\.(jpe?g|png|webp|gif)$/i;
const VIDEO_EXT = /\.(mp4|webm|mov)$/i;
const IMAGE_WINDOW_DAYS = 7;
const GALLERY_MAX = 6;

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

  if (gallery.length === 0 && videos.length === 0) return undefined;
  return {
    cover: gallery[0],
    gallery: gallery.slice(1, 1 + GALLERY_MAX),
    videos: videos.slice(0, 2),
  };
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

  // 근속 마일스톤 + 생일 — 발행일부터 7일 내 도래분
  const milestones = upcomingAnniversaries(
    operators
      .filter((o) => o.hired_at)
      .map((o) => ({ name: o.name, hired_at: o.hired_at! })),
    todayYmd,
  );
  const birthdays = upcomingBirthdays(
    operators
      .filter((o) => o.birth_date)
      .map((o) => ({ name: o.name, birth_date: o.birth_date! })),
    todayYmd,
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

  // 이번 주 기능 소개 — 다음 발행 호수 기준으로 3개 순환 선택.
  const { count: publishedCount } = await admin
    .from("team_briefings")
    .select("id", { count: "exact", head: true });
  const featureIntros = pickFeatureIntros((publishedCount ?? 0) + 1, 3);

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

/**
 * 뉴스레터 발행 — team_briefings insert 후 Teams 티저 발송.
 * 방 미설정이면 발행만 하고 발송은 생략(sent: false).
 */
export async function publishBriefing(
  payload: BriefingPayload,
): Promise<
  | { ok: true; issueNo: number; url: string; sent: boolean }
  | { ok: false; message: string }
> {
  const chatId = process.env.TEAMS_NOTICE_CHAT_ID || "";
  const sender =
    process.env.TEAMS_BRIEFING_SENDER ||
    process.env.TEAMS_NOTICE_SENDER ||
    BRIEFING_SENDER_DEFAULT;

  const admin = createAdminClient();
  const { count, error: cntErr } = await admin
    .from("team_briefings")
    .select("id", { count: "exact", head: true });
  if (cntErr)
    return { ok: false, message: `브리핑 호수 조회 실패: ${cntErr.message}` };
  const issueNo = (count ?? 0) + 1;
  const shareToken = crypto.randomUUID().replace(/-/g, "");
  const { error: insErr } = await admin.from("team_briefings").insert({
    issue_no: issueNo,
    briefing_date: kstTodayYmd(),
    payload,
    share_token: shareToken,
  });
  if (insErr)
    return { ok: false, message: `뉴스레터 발행 실패: ${insErr.message}` };

  const url = `${baseUrl()}/r/briefing/${shareToken}`;
  if (!chatId) return { ok: true, issueNo, url, sent: false };

  const html = buildBriefingTeaserHtml({
    issueNo,
    dateLabel: payload.dateLabel,
    headline: payload.story?.headline,
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

/** registry 수동 실행/폴백 — 스토리 없이 집계→발행→티저. 정규 발행은 로컬 launchd. */
export async function runTeamBriefing(): Promise<AutomationRunResult> {
  const chatId = process.env.TEAMS_NOTICE_CHAT_ID || "";
  const dryRun =
    process.env.TEAM_BRIEFING_DRY_RUN === "true" ||
    process.env.MAIL_DRY_RUN === "true";

  // 방 미설정이면 발행/발송 없이 로그만(차주보고 방 폴백 없음). 드라이런은 집계까지 수행.
  if (!dryRun && !chatId) {
    return {
      ok: true,
      message: "Teams 채팅방 미설정 (TEAMS_NOTICE_CHAT_ID) — 발송 생략(로그만)",
    };
  }

  const built = await buildBriefingData();
  if (!built.ok) return { ok: false, message: built.message };
  const { payload, details } = built;

  if (dryRun) {
    return {
      ok: true,
      message: `DRY-RUN — 브리핑 생성(발행·발송 생략). 계약 완료 ${details.contractsDone}·진행 ${details.contractsOngoing}, 마감임박 ${details.closing}건, AI작업 ${details.aiWorkCount}건·TIP 신규 ${details.tipsNew}건`,
      details,
    };
  }

  const published = await publishBriefing(payload);
  if (!published.ok) return { ok: false, message: published.message };
  return {
    ok: true,
    message: `팀 보고 브리핑 #${published.issueNo} 발행·발송 완료 (마감임박 ${details.closing}건)`,
    details: { ...details, issueNo: published.issueNo },
  };
}
