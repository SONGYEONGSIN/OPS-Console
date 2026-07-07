import { z } from "zod";

/* ════════════════════════════════════════════════════════════
   enums + 상수
   ════════════════════════════════════════════════════════════ */

export const cycleStatusSchema = z.enum(["open", "closed"]);
export type CycleStatus = z.infer<typeof cycleStatusSchema>;

/** 4단계 관리자 중심 워크플로우 — 1=목표설정(팀원), 2=실행계획·성과지표(팀원),
 *  3=정량집계·관리자평가(관리자), 4=발행완료. */
export const STEP_VALUES = [1, 2, 3, 4] as const;
export type Step = (typeof STEP_VALUES)[number];
export const stepSchema = z
  .number()
  .int()
  .refine((v): v is Step => STEP_VALUES.includes(v as Step), {
    message: "step은 1..4 사이의 정수",
  });

/** 단계 라벨 (Stepper/View/Table 공통 단일 소스). */
export const STEP_LABEL: Record<Step, string> = {
  1: "목표설정",
  2: "실행계획·지표",
  3: "정량집계·평가",
  4: "발행완료",
};

export const ROLE_VALUES = ["evaluator", "evaluatee"] as const;
export type Role = (typeof ROLE_VALUES)[number];
export const roleSchema = z.enum(ROLE_VALUES);

/** 평가 등급 — 종합평가(step=7) 단계의 성과/역량 2축. */
export const GRADE_VALUES = ["S", "A", "B", "C", "D"] as const;
export type Grade = (typeof GRADE_VALUES)[number];
export const gradeSchema = z.enum(GRADE_VALUES);

/** 평가 등급 가이드라인 — UI tooltip / 인쇄 페이지 description 인용. */
export const GRADE_DESCRIPTION_PERFORMANCE: Record<Grade, string> = {
  S: "예상치 못한 탁월한 성과. 모두의 박수를 받을 만함.",
  A: "기대 이상의 성취. 동료들에게 자극과 모범이 됨.",
  B: "도전을 통해 기대를 충족할 만한 결과를 얻음.",
  C: "기본적인 수준에서 업무를 완료함.",
  D: "진전을 이루지 못함. 타인의 관리가 필요한 상황.",
};
export const GRADE_DESCRIPTION_COMPETENCY: Record<Grade, string> = {
  S: "예상치 못한 탁월한 성장. 앞으로가 매우 기대됨.",
  A: "기대 이상의 성장. 동료들에게 자극과 모범이 됨.",
  B: "도전을 통해 기대를 충족할 만한 성장을 얻음.",
  C: "기본적인 수준에서 역량이 향상됨.",
  D: "진전을 이루지 못함. 타인의 관리가 필요한 상황.",
};

/* ════════════════════════════════════════════════════════════
   row 스키마 — 5 테이블
   ════════════════════════════════════════════════════════════ */

export const cycleRowSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  status: cycleStatusSchema,
  created_at: z.string(),
  updated_at: z.string(),
});
export type CycleRow = z.infer<typeof cycleRowSchema>;

export const assignmentRowSchema = z.object({
  id: z.string().uuid(),
  cycle_id: z.string().uuid(),
  evaluator_email: z.string().email(),
  evaluatee_email: z.string().email(),
  current_step: stepSchema,
  created_at: z.string(),
  updated_at: z.string(),
});
export type AssignmentRow = z.infer<typeof assignmentRowSchema>;

export const goalRowSchema = z.object({
  id: z.string().uuid(),
  assignment_id: z.string().uuid(),
  title: z.string().min(1),
  body: z.string().nullable().optional(),
  weight: z.number().min(0).max(1),
  created_at: z.string(),
});
export type GoalRow = z.infer<typeof goalRowSchema>;

export const planRowSchema = z.object({
  id: z.string().uuid(),
  goal_id: z.string().uuid(),
  body: z.string().nullable().optional(),
  created_at: z.string(),
  updated_at: z.string(),
});
export type PlanRow = z.infer<typeof planRowSchema>;

/** review step은 3..7만 (1=목표설정/2=실행계획/8=완료는 review row가 아님). */
const reviewStepSchema = z
  .number()
  .int()
  .refine((v) => v >= 3 && v <= 7, "step은 3..7 사이");

export const reviewRowSchema = z.object({
  id: z.string().uuid(),
  assignment_id: z.string().uuid(),
  step: reviewStepSchema,
  role: roleSchema,
  body: z.string().nullable().optional(),
  score: z.number().nullable().optional(),
  grade_performance: gradeSchema.nullable().optional(),
  grade_competency: gradeSchema.nullable().optional(),
  created_at: z.string(),
});
export type ReviewRow = z.infer<typeof reviewRowSchema>;

/* ════════════════════════════════════════════════════════════
   create/update 스키마 (server actions 입력)
   ════════════════════════════════════════════════════════════ */

export const goalCreateSchema = z.object({
  assignment_id: z.string().uuid(),
  title: z.string().min(1),
  body: z.string().nullable().optional(),
  weight: z.number().min(0).max(1).default(0),
});
export type GoalCreate = z.infer<typeof goalCreateSchema>;

export const planUpsertSchema = z.object({
  goal_id: z.string().uuid(),
  body: z.string().nullable().optional(),
});
export type PlanUpsert = z.infer<typeof planUpsertSchema>;

export const reviewCreateSchema = z.object({
  assignment_id: z.string().uuid(),
  step: reviewStepSchema,
  role: roleSchema,
  body: z.string().nullable().optional(),
  score: z.number().nullable().optional(),
  grade_performance: gradeSchema.nullable().optional(),
  grade_competency: gradeSchema.nullable().optional(),
});
export type ReviewCreate = z.infer<typeof reviewCreateSchema>;

/* ════════════════════════════════════════════════════════════
   신규: 성과지표(performance_metrics) + 관리자 루브릭(performance_rubric_scores)
   ════════════════════════════════════════════════════════════ */

/** 성과지표 row — assignment당 N개, weight 합=80(정수 points). */
export const metricRowSchema = z.object({
  id: z.string().uuid(),
  assignment_id: z.string().uuid(),
  name: z.string().min(1),
  /** 가중치 (정수 points, 합=80 검증은 scoring.isValidMetricWeights) */
  weight: z.number().int().min(0).max(80),
  /** 정량 소스 키 (aggregators/registry) 또는 null(수동 지표) */
  source_key: z.string().nullable(),
  /** before/after 수동 입력 (시간절감·오류율 등) */
  before_value: z.number().nullable(),
  after_value: z.number().nullable(),
  /** 달성률 0~100 (scoring 입력) */
  achievement: z.number().min(0).max(100).nullable(),
  created_at: z.string(),
  updated_at: z.string(),
});
export type MetricRow = z.infer<typeof metricRowSchema>;

export const metricCreateSchema = z.object({
  assignment_id: z.string().uuid(),
  name: z.string().min(1),
  weight: z.number().int().min(0).max(80),
  source_key: z.string().nullable().optional(),
  before_value: z.number().nullable().optional(),
  after_value: z.number().nullable().optional(),
  achievement: z.number().min(0).max(100).nullable().optional(),
});
export type MetricCreate = z.infer<typeof metricCreateSchema>;

/** 관리자 루브릭 항목 — 태도·문화 / 협업 / 문제해결. */
export const RUBRIC_CRITERIA = ["태도·문화", "협업", "문제해결"] as const;
export type RubricCriterion = (typeof RUBRIC_CRITERIA)[number];
export const rubricCriterionSchema = z.enum(RUBRIC_CRITERIA);

export const rubricScoreRowSchema = z.object({
  id: z.string().uuid(),
  assignment_id: z.string().uuid(),
  criterion: rubricCriterionSchema,
  /** 1~5 척도 */
  score: z.number().int().min(1).max(5),
  comment: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
});
export type RubricScoreRow = z.infer<typeof rubricScoreRowSchema>;

export const rubricUpsertSchema = z.object({
  assignment_id: z.string().uuid(),
  criterion: rubricCriterionSchema,
  score: z.number().int().min(1).max(5),
  comment: z.string().nullable().optional(),
});
export type RubricUpsert = z.infer<typeof rubricUpsertSchema>;
