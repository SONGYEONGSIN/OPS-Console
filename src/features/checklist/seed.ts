import type { Department, ChecklistItem } from "./schemas";

export type SeedRow = {
  department: Department;
  category: string;
  title: string;
  status: null;
  note: string;
  sortOrder: number;
};

// 순수: 시드 방식별 삽입할 items 행 생성.
// ("use server" 파일은 모든 export가 async여야 하므로 순수 헬퍼는 actions.ts 밖 이 모듈에 둔다.)
export function buildSeedItems(
  seed: "template" | "clone" | "empty",
  template: { department: Department; category: string; title: string }[],
  clonedItems: Pick<
    ChecklistItem,
    "department" | "category" | "title" | "sortOrder"
  >[],
): SeedRow[] {
  if (seed === "empty") return [];
  if (seed === "clone")
    return clonedItems.map((i) => ({
      department: i.department,
      category: i.category,
      title: i.title,
      status: null,
      note: "",
      sortOrder: i.sortOrder,
    }));
  return template.map((t, idx) => ({
    department: t.department,
    category: t.category,
    title: t.title,
    status: null,
    note: "",
    sortOrder: idx,
  }));
}
