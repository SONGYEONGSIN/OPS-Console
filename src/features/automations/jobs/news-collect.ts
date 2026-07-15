import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  NEWS_SOURCES,
  OPERATIONAL_KEYWORDS,
  buildGoogleNewsRssUrl,
  parseRssItems,
  mapRssItemsToNews,
  mapFeedItemsToNews,
  dedupeByLink,
  dedupeByTitle,
  type NewsRow,
} from "./news-sources";
import { dedupeByContext } from "./news-context";
import type { AutomationRunResult } from "../types";

export const CLEANUP_DAYS = 60;
// 동일 맥락 군집 정리 대상 기간 — 같은 사건은 보통 며칠~2주에 몰리므로 최근분만 정리해
// 파괴적 삭제 범위를 제한한다(과거 기사는 CLEANUP_DAYS 정리에 위임).
export const CONTEXT_WINDOW_DAYS = 30;

/** 단일 소스 fetch → news row[]. 실패 시 throw(상위에서 errors 누적). */
async function fetchSourceRows(
  source: (typeof NEWS_SOURCES)[number],
): Promise<NewsRow[]> {
  const isGoogle = source.kind === "google";
  const url = isGoogle
    ? buildGoogleNewsRssUrl(`대학 ${source.keyword}`)
    : source.url;
  const name = isGoogle ? source.keyword : source.label;
  const res = await fetch(url);
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`${name} HTTP ${res.status}: ${body.slice(0, 200)}`);
  }
  const xml = await res.text();
  const items = parseRssItems(xml);
  return isGoogle
    ? mapRssItemsToNews(items, source.keyword)
    : mapFeedItemsToNews(items, OPERATIONAL_KEYWORDS, source.label);
}

export async function runNewsCollect(): Promise<AutomationRunResult> {
  const errors: string[] = [];
  const collected: NewsRow[] = [];

  // 1~3) 소스 순회 fetch → 파싱/정규화 (소스 1개 실패해도 계속)
  for (const source of NEWS_SOURCES) {
    try {
      collected.push(...(await fetchSourceRows(source)));
    } catch (e) {
      errors.push(e instanceof Error ? e.message : String(e));
    }
  }

  // dedupe — link 기준 1차, title 기준 2차, 동일 맥락(같은 사건) 3차로 최신 1건만.
  // (같은 기사가 키워드마다 다른 구글 뉴스 link로 잡혀 link-unique로 미차단;
  //  같은 사건이 매체·날짜별 다른 제목으로 잡히는 건 dedupeByContext로 접는다)
  const rows = dedupeByContext(dedupeByTitle(dedupeByLink(collected)));
  if (rows.length === 0) {
    return {
      ok: errors.length === 0,
      message: errors.length
        ? `수집 실패: ${errors.length}건`
        : "신규 뉴스가 없습니다.",
      details: { collected: 0, errors: errors.length },
    };
  }

  const errorSuffix = () => (errors.length ? ` (${errors.length}건 오류)` : "");

  // 4) admin upsert (onConflict title — 동일 기사 중복 방지)
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("news")
    .upsert(rows, { onConflict: "title", ignoreDuplicates: false })
    .select("title");
  if (error) {
    return { ok: false, message: `upsert 실패: ${error.message}` };
  }

  // 5) 60일 지난 행 cleanup
  const cleanupCutoff = new Date(
    Date.now() - CLEANUP_DAYS * 24 * 60 * 60 * 1000,
  ).toISOString();
  const { data: deleted, error: cleanupError } = await supabase
    .from("news")
    .delete()
    .lt("collected_at", cleanupCutoff)
    .select("id");
  if (cleanupError) {
    errors.push(`cleanup 실패: ${cleanupError.message}`);
  }

  // 6) 동일 맥락 군집 정리 — 최근(CONTEXT_WINDOW_DAYS) 기사 중 같은 사건은 최신 1건만 남기고
  // 나머지 삭제. 배치 dedup은 같은 run 안에서만 접으므로, 과거 run으로 누적된 동일-맥락
  // 기사를 여기서 주기적으로 접는다. 윈도우로 파괴적 삭제 범위를 제한한다.
  let contextCleaned = 0;
  const contextCutoff = new Date(
    Date.now() - CONTEXT_WINDOW_DAYS * 24 * 60 * 60 * 1000,
  ).toISOString();
  const { data: recent, error: recentError } = await supabase
    .from("news")
    .select("id, title, published_at")
    .gte("published_at", contextCutoff);
  if (recentError) {
    errors.push(`맥락 정리 조회 실패: ${recentError.message}`);
  } else if (recent && recent.length > 0) {
    const keep = new Set(dedupeByContext(recent).map((r) => r.id));
    const dropIds = recent.filter((r) => !keep.has(r.id)).map((r) => r.id);
    if (dropIds.length > 0) {
      const { error: ctxError } = await supabase
        .from("news")
        .delete()
        .in("id", dropIds);
      if (ctxError) errors.push(`맥락 정리 실패: ${ctxError.message}`);
      else contextCleaned = dropIds.length;
    }
  }

  const totalCleaned = (deleted?.length ?? 0) + contextCleaned;

  return {
    ok: true,
    message: `${data?.length ?? 0}건 적재, ${totalCleaned}건 정리(만료 ${deleted?.length ?? 0}·중복맥락 ${contextCleaned})${errorSuffix()}`,
    details: {
      upserted: data?.length ?? 0,
      cleaned: deleted?.length ?? 0,
      contextCleaned,
      errors: errors.length,
    },
  };
}
