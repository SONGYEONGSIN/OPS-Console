import "server-only";
import { cache } from "react";
import { parseSmsSender, SheetShapeError } from "./parse";
import { fetchSmsSenderSource, SourceFetchError } from "./source";
import type { SmsSenderData } from "./types";

export type SmsSenderResult =
  { ok: true; data: SmsSenderData } | { ok: false; message: string };

/**
 * 캐시 2겹: React cache(같은 요청 안 dedupe) + 모듈 TTL(10분).
 * 성공만 저장한다 — 실패를 저장하면 복구된 뒤에도 10분간 오류 화면이 남는다.
 */
const TTL_MS = 10 * 60 * 1000;
type CacheEntry = { data: SmsSenderData; expiresAt: number };
let moduleCache: CacheEntry | null = null;

export const getSmsSenderData = cache(
  async function getSmsSenderData(): Promise<SmsSenderResult> {
    if (moduleCache && moduleCache.expiresAt > Date.now()) {
      return { ok: true, data: moduleCache.data };
    }
    try {
      const data = parseSmsSender(await fetchSmsSenderSource());
      moduleCache = { data, expiresAt: Date.now() + TTL_MS };
      return { ok: true, data };
    } catch (e) {
      if (e instanceof SheetShapeError || e instanceof SourceFetchError) {
        return { ok: false, message: e.message };
      }
      console.error("[sms-sender] unexpected error:", e);
      return { ok: false, message: "현황 파일을 읽지 못했습니다." };
    }
  },
);

/** 새로고침 action·테스트용 TTL 캐시 리셋 */
export function __resetSmsSenderCache(): void {
  moduleCache = null;
}
