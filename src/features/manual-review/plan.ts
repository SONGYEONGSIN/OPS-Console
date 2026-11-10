import type { ResolvedManual } from "@/features/manual-ledger/types";

export type ReviewItem = {
  task: string;
  docName: string;
  webUrl: string | null;
  lastModified: string | null;
};

export type ReviewRecipient = {
  /** 소문자 메일 — 이력의 수신자 키. */
  key: string;
  email: string;
  name: string;
  items: ReviewItem[];
};

export type ReviewIssue = { task: string; docName: string; ownerText: string };

export type ReviewPlan = {
  recipients: ReviewRecipient[];
  manualCount: number;
  unresolvedOwners: ReviewIssue[];
  unlinked: ReviewIssue[];
  /** 연간 일정 '진행 중' 인데 대장에 한 행도 없는 업무 — 이름이 갈리면 그 업무 매뉴얼이 통째로 빠진다. */
  missingTasks: string[];
  /** 문서명은 있는데 업무 칸이 빈 대장 행 — 어느 구역인지 몰라 알림에서 빠진다. */
  untasked: ReviewIssue[];
};

const EMPTY_OWNER = "(빈칸)";

const byTaskThenDoc = (a: ReviewItem, b: ReviewItem): number =>
  a.task.localeCompare(b.task, "ko") ||
  a.docName.localeCompare(b.docName, "ko");

const toItem = (m: ResolvedManual): ReviewItem => ({
  task: m.task,
  docName: m.docName,
  webUrl: m.file?.webUrl ?? null,
  lastModified: m.lastModified,
});

function unresolvedIssue(m: ResolvedManual): ReviewIssue | null {
  if (m.owners.length === 0) {
    return { task: m.task, docName: m.docName, ownerText: EMPTY_OWNER };
  }
  if (m.unresolvedOwners.length === 0) return null;
  return {
    task: m.task,
    docName: m.docName,
    ownerText: m.unresolvedOwners.join(", "),
  };
}

function groupByRecipient(manuals: ResolvedManual[]): ReviewRecipient[] {
  const groups = new Map<string, ReviewRecipient>();
  for (const m of manuals) {
    for (const r of m.recipients) {
      const key = r.email.trim().toLowerCase();
      const prev = groups.get(key);
      const items = [...(prev?.items ?? []), toItem(m)];
      groups.set(key, {
        key,
        email: prev?.email ?? r.email,
        name: prev?.name ?? r.name,
        items,
      });
    }
  }
  return [...groups.values()]
    .map((g) => ({ ...g, items: [...g.items].sort(byTaskThenDoc) }))
    .sort((a, b) => a.name.localeCompare(b.name, "ko"));
}

/**
 * 진행 중 업무의 매뉴얼만 담당자별로 묶는다. 파일을 못 찾은 행도 담당자에게는
 * 링크 없이 보내고, 담당자를 못 찾은 행·파일을 못 찾은 행은 관리자 요약으로 올린다
 * — 어느 쪽도 조용히 빠지지 않게.
 */
export function buildReviewPlan(
  manuals: ResolvedManual[],
  activeTasks: ReadonlySet<string>,
): ReviewPlan {
  const active = manuals.filter((m) => m.active);
  const ledgerTasks = new Set(
    manuals.map((m) => m.task).filter((t) => t !== ""),
  );
  return {
    missingTasks: [...activeTasks]
      .filter((t) => !ledgerTasks.has(t))
      .sort((a, b) => a.localeCompare(b, "ko")),
    untasked: manuals
      .filter((m) => m.task === "" && m.docName !== "")
      .map((m) => ({ task: "", docName: m.docName, ownerText: m.ownerText })),
    recipients: groupByRecipient(active),
    manualCount: active.length,
    unresolvedOwners: active.flatMap((m) => {
      const issue = unresolvedIssue(m);
      return issue ? [issue] : [];
    }),
    unlinked: active
      .filter((m) => m.file === null)
      .map((m) => ({
        task: m.task,
        docName: m.docName,
        ownerText: m.ownerText,
      })),
  };
}
