import "server-only";
import { indexVault } from "@/features/knowledge/index-vault";
import type { AutomationRunResult } from "../types";

/**
 * AutomationJob.run — 업무 지식망 볼트를 훑어 검색 인덱스를 갱신한다.
 *
 * 회사 PC가 아니라 서버에서 돈다. Graph로 SharePoint를 직접 읽으므로 PC가 꺼져
 * 있어도 무관하다. 주기는 daily로 시작하되, 급하면 자동화 페이지에서 수동 실행한다
 * — 실제 편집 빈도가 보이면 그때 조정한다(지금은 관측 데이터가 없다).
 */
export async function runKnowledgeIndex(): Promise<AutomationRunResult> {
  return indexVault();
}
