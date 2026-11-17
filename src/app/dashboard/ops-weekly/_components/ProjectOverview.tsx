"use client";

import type { ProjectGroup } from "@/features/ops-weekly/merge";
import { ReadOnlyHtml } from "./ProjectTab";

/** 프로젝트 먼저, 그다음 TF — 각 묶음 안의 순서는 그대로 둔다. */
function projectsFirst(groups: readonly ProjectGroup[]): ProjectGroup[] {
  return [
    ...groups.filter((g) => g.kind === "project"),
    ...groups.filter((g) => g.kind === "tf"),
  ];
}

export function ProjectOverview({ groups }: { groups: ProjectGroup[] }) {
  return (
    <section className="flex flex-col gap-3 border-t border-line pt-6">
      <h2 className="text-xl font-bold text-ink">프로젝트·TF 모아보기</h2>
      {groups.length === 0 ? (
        <div className="border border-line-soft bg-situation-bg px-4 py-6 text-sm text-ink">
          <p>작성된 항목이 없습니다</p>
        </div>
      ) : (
        projectsFirst(groups).map((g) => (
          <section
            key={g.projectId}
            aria-label={g.projectName}
            className="flex flex-col gap-3 border border-line-soft bg-situation-bg p-4"
          >
            <h3 className="text-sm font-bold text-ink">
              {g.projectName}
              <span className="ml-2 text-xs font-normal text-muted">
                {g.kind === "tf" ? "TF" : "프로젝트"}
              </span>
            </h3>
            {g.owners.map((o) => (
              <div
                key={o.operatorEmail}
                className="flex flex-col gap-2 border-t border-line-soft pt-3"
              >
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <span
                    data-testid="owner-name"
                    className="min-w-0 break-words font-medium"
                  >
                    {o.operatorName}
                  </span>
                  <span className="text-xs text-muted">{o.stage ?? "—"}</span>
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  <ReadOnlyHtml label="금주" html={o.thisWeek} />
                  <ReadOnlyHtml label="차주" html={o.nextWeek} />
                </div>
              </div>
            ))}
          </section>
        ))
      )}
    </section>
  );
}
