import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  NEWS_SOURCES,
  buildGoogleNewsRssUrl,
  parseRssItems,
  mapRssItemsToNews,
  dedupeByLink,
  dedupeByTitle,
  type NewsRow,
} from "./news-sources";
import type { AutomationRunResult } from "../types";

export const CLEANUP_DAYS = 60;

/** 단일 소스 fetch → news row[]. 실패 시 throw(상위에서 errors 누적). */
async function fetchSourceRows(
  source: (typeof NEWS_SOURCES)[number],
): Promise<NewsRow[]> {
  const url =
    source.kind === "google"
      ? buildGoogleNewsRssUrl(`대학 ${source.keyword}`)
      : source.url;
  const res = await fetch(url);
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`${source.keyword} HTTP ${res.status}: ${body.slice(0, 200)}`);
  }
  const xml = await res.text();
  return mapRssItemsToNews(parseRssItems(xml), source.keyword);
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

  // dedupe — link 기준 1차 후 title 기준 2차
  // (같은 기사가 키워드마다 다른 구글 뉴스 link로 잡혀 link-unique로 미차단)
  const rows = dedupeByTitle(dedupeByLink(collected));
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

  return {
    ok: true,
    message: `${data?.length ?? 0}건 적재, ${deleted?.length ?? 0}건 정리${errorSuffix()}`,
    details: {
      upserted: data?.length ?? 0,
      cleaned: deleted?.length ?? 0,
      errors: errors.length,
    },
  };
}
