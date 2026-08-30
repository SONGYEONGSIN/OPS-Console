import { z } from "zod";
import { AGGREGATOR_KEYS } from "./aggregators/registry";

/**
 * 조직 목표(본부·팀) 등록 스키마.
 *
 * 개인 목표(`performance_goals`)는 assignment 에 매달려 있어 "팀 전체가 무엇을
 * 목표로 하는가"를 담을 수 없다. 이 표가 따로 있는 이유다.
 *
 * 조직 목표 하나가 여러 사람의 달성률을 좌우하므로 **폼을 믿지 않고 여기서 막는다.**
 */
export const orgGoalUpsertSchema = z
  .object({
    id: z.string().uuid().optional(),
    // 개인은 performance_goals 가 담는다 — 여기 넣으면 두 곳에 같은 목표가 생긴다.
    scope: z.enum(["division", "team"]),
    owner_name: z.string().min(1),
    period_start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    period_end: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    title: z.string().min(1),
    // 0 은 나눌 수 없어 달성률이 null 이 된다. 등록 단계에서 막는다.
    target_value: z.number().positive().nullable().optional(),
    unit: z.string().nullable().optional(),
    // 집계로 실적을 낼 수 있으면 aggregator 키. 없으면 사람이 눈으로 본다.
    source_key: z.enum(AGGREGATOR_KEYS).nullable().optional(),
    lower_is_better: z.boolean().default(false),
    note: z.string().nullable().optional(),
  })
  // 끝이 시작보다 앞서면 기간 안에 아무것도 안 들어와 실적이 늘 0 이 된다.
  .refine((v) => v.period_start <= v.period_end, {
    message: "종료일이 시작일보다 앞섭니다",
    path: ["period_end"],
  });

export type OrgGoalUpsert = z.infer<typeof orgGoalUpsertSchema>;
