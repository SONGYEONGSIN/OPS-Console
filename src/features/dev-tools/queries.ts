import "server-only";

import { createClient } from "@/lib/supabase/server";
import { TOOL_CATALOG } from "./catalog.generated";
import { mergeToggles, unappliedCount, groupCounts, type Toggle, type ToolRow } from "./merge";
import type { ToolKind } from "./scan";

export type ApplyRecord = { machine: string; appliedAt: string };

export type ToolBoard = {
  rows: ToolRow[];
  counts: Record<ToolKind, number>;
  applies: ApplyRecord[];
  /** 아직 어느 PC에도 반영 안 된 변경 건수. */
  unapplied: number;
};

/**
 * 도구 목록 — 카탈로그(파일)와 토글(결정)을 합쳐 돌려준다.
 *
 * 목록은 DB가 아니라 `catalog.generated.ts` 에서 온다. 레포 `.claude/` 를 훑어
 * 만든 것이라 파일이 곧 진실이고, DB에는 사람이 끈 기록만 있다.
 */
export async function loadToolBoard(): Promise<ToolBoard> {
  const supabase = await createClient();

  const [{ data: toggleRows }, { data: applyRows }] = await Promise.all([
    supabase.from("dev_tool_toggles").select("kind, name, enabled, updated_at"),
    supabase.from("dev_tool_applies").select("machine, applied_at"),
  ]);

  const toggles: Toggle[] = (toggleRows ?? []).map((r) => ({
    kind: r.kind as ToolKind,
    name: r.name,
    enabled: r.enabled,
    updatedAt: r.updated_at,
  }));

  const applies: ApplyRecord[] = (applyRows ?? [])
    .map((r) => ({ machine: r.machine, appliedAt: r.applied_at }))
    .sort((a, b) => b.appliedAt.localeCompare(a.appliedAt));

  return {
    rows: mergeToggles(TOOL_CATALOG, toggles),
    counts: groupCounts(TOOL_CATALOG),
    applies,
    // 가장 최근에 반영한 PC 기준으로 센다. 여러 PC가 있으면 나머지는 더 뒤처져
    // 있을 수 있는데, 화면이 PC별 시각을 함께 보여주므로 거기서 드러난다.
    unapplied: unappliedCount(toggles, applies[0]?.appliedAt ?? null),
  };
}
