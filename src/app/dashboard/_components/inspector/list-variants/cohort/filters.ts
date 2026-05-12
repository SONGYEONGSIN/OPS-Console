import type { ListRow } from "../../../patterns/ListPattern";

export type CohortFilter = "all" | "planned" | "in_progress" | "completed";

export const COHORT_FILTERS: { value: CohortFilter; label: string }[] = [
  { value: "all", label: "전체" },
  { value: "planned", label: "계획" },
  { value: "in_progress", label: "진행중" },
  { value: "completed", label: "완료" },
];

export function blankCohortRow(): ListRow {
  const today = new Date().toISOString().slice(0, 10);
  return {
    id: "",
    name: "",
    status: "active",
    owner: "",
    traineeEmail: "",
    mentorEmail: null,
    startDate: today,
    endDate: null,
    cohortStatus: "planned",
  };
}
