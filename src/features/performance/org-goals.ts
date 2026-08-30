import "server-only";
import { createClient } from "@/lib/supabase/server";
import { OPERATORS } from "@/features/auth/operators";
import { orgGoalMembers, type OrgGoalScope } from "./org-goal-members";
import { computeQuant } from "./queries";
import { achievementOf } from "./achievement";

export type OrgGoalRow = {
  id: string;
  scope: OrgGoalScope;
  owner_name: string;
  period_start: string;
  period_end: string;
  title: string;
  target_value: number | null;
  unit: string | null;
  source_key: string | null;
  lower_is_better: boolean;
  note: string | null;
  /** 소속원 실적 합산. 집계 소스가 없으면 null — 0 이 아니다. */
  actual: number | null;
  /** 합산에 들어간 인원. 0 명이면 조직 이름이 조직도와 안 맞는다는 신호다. */
  memberCount: number;
  achievement: number | null;
};

/**
 * 조직 목표 목록 — 등록된 목표에 **소속원 실적 합산**을 붙여 돌려준다.
 *
 * 목표만 적어 두면 아무도 안 보는 표가 된다. `source_key` 컬럼이 있는 이유가
 * 실적을 자동으로 내기 위해서다.
 *
 * 집계 소스가 없으면 `actual` 은 **null 이다(0 아님)** — 0 은 '한 건도 못 했다'로
 * 읽히는데 실제로는 '셀 방법이 없다'이다.
 */
export async function listOrgGoals(): Promise<OrgGoalRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("performance_org_goals")
    .select(
      "id, scope, owner_name, period_start, period_end, title, target_value, unit, source_key, lower_is_better, note",
    )
    .order("period_start", { ascending: false })
    .order("owner_name", { ascending: true });
  if (error) throw new Error(`조직 목표 조회 실패: ${error.message}`);

  const goals = (data ?? []) as Omit<
    OrgGoalRow,
    "actual" | "memberCount" | "achievement"
  >[];

  return Promise.all(
    goals.map(async (g) => {
      const members = orgGoalMembers(g.scope, g.owner_name, OPERATORS);
      const period = { startYmd: g.period_start, endYmd: g.period_end };
      let actual: number | null = null;
      if (g.source_key && members.length > 0) {
        const values = await Promise.all(
          members.map((email) =>
            computeQuant(supabase, g.source_key as string, email, period),
          ),
        );
        // 한 명이라도 집계되면 합산한다. 전원 null 이면 셀 수 없는 소스다.
        const counted = values.filter((v) => v !== null);
        actual =
          counted.length > 0
            ? counted.reduce((sum, v) => sum + (v?.value ?? 0), 0)
            : null;
      }
      return {
        ...g,
        actual,
        memberCount: members.length,
        achievement: achievementOf({
          actual,
          target: g.target_value,
          lowerIsBetter: g.lower_is_better,
        }),
      };
    }),
  );
}
