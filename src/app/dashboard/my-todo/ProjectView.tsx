"use client";

import { useMemo, useState } from "react";
import type {
  ProjectRow,
  ProjectTaskRow,
} from "@/features/projects/schemas";
import { ListPattern } from "../_components/patterns/ListPattern";
import type { ListRow } from "../_components/patterns/ListPattern";
import { GanttChart } from "./GanttChart";

type PersistResult = { ok: boolean; error?: string };

export type ProjectWithTasksView = {
  project: ProjectRow;
  tasks: ProjectTaskRow[];
};

type Props = {
  projectsWithTasks: ProjectWithTasksView[];
  canWrite: boolean;
  onPersistProject: (row: ListRow, isNew: boolean) => Promise<PersistResult>;
  onPersistTask: (row: ListRow, isNew: boolean) => Promise<PersistResult>;
};

/** sub-task 평균 progress (소수점 절사). tasks 없으면 0. */
function computeAggregatedProgress(tasks: ProjectTaskRow[]): number {
  if (tasks.length === 0) return 0;
  const sum = tasks.reduce((acc, t) => acc + t.progress, 0);
  return Math.floor(sum / tasks.length);
}

function projectToListRow(p: ProjectRow, tasks: ProjectTaskRow[]): ListRow {
  return {
    id: p.id,
    name: p.name,
    status: "active",
    owner:
      p.owner_email === p.created_by_email ? "본인" : p.owner_email.split("@")[0]!,
    priority: p.priority,
    progress: computeAggregatedProgress(tasks),
    todoStatus: p.status,
    description: p.description ?? "",
    startDateYmd: p.start_at ?? null,
    endDateYmd: p.end_at ?? null,
    projectOwnerEmail: p.owner_email,
    totalTaskCount: tasks.length,
    doneTaskCount: tasks.filter((t) => t.status === "done").length,
  };
}

function taskToListRow(t: ProjectTaskRow): ListRow {
  return {
    id: t.id,
    name: t.name,
    status: "active",
    owner: t.assignee_email ? t.assignee_email.split("@")[0]! : "",
    priority: t.priority,
    progress: t.progress,
    todoStatus: t.status,
    startDateYmd: t.start_at ?? null,
    endDateYmd: t.end_at ?? null,
    taskAssigneeEmail: t.assignee_email ?? null,
    projectId: t.project_id,
  };
}

export function ProjectView({
  projectsWithTasks,
  canWrite,
  onPersistProject,
  onPersistTask,
}: Props) {
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(
    projectsWithTasks[0]?.project.id ?? null,
  );
  const [inspectorOpen, setInspectorOpen] = useState(false);

  const projectRows: ListRow[] = projectsWithTasks.map((pwt) =>
    projectToListRow(pwt.project, pwt.tasks),
  );

  const selectedTasks = useMemo(() => {
    const found = projectsWithTasks.find(
      (pwt) => pwt.project.id === selectedProjectId,
    );
    return found?.tasks.map(taskToListRow) ?? [];
  }, [projectsWithTasks, selectedProjectId]);

  const ganttItems = useMemo(() => {
    const result: Parameters<typeof GanttChart>[0]["items"] = [];
    for (const pwt of projectsWithTasks) {
      result.push({
        id: pwt.project.id,
        name: pwt.project.name,
        startYmd: pwt.project.start_at ?? null,
        endYmd: pwt.project.end_at ?? null,
        priority: pwt.project.priority,
        progress: computeAggregatedProgress(pwt.tasks),
        isParent: true,
      });
      for (const t of pwt.tasks) {
        result.push({
          id: t.id,
          name: `  ${t.name}`,
          startYmd: t.start_at ?? null,
          endYmd: t.end_at ?? null,
          priority: t.priority,
          progress: t.progress,
          isParent: false,
        });
      }
    }
    return result;
  }, [projectsWithTasks]);

  if (projectsWithTasks.length === 0) {
    return (
      <section className="p-7">
        <div className="border border-line-soft bg-cream p-12 text-center">
          <p className="text-base text-ink">프로젝트 없음</p>
          <p className="mt-2 text-xs text-muted">
            아래 &lsquo;+ 새 프로젝트&rsquo; 버튼으로 시작하세요.
          </p>
          <div className="mt-4 inline-block">
            <ListPattern
              title="프로젝트"
              data={{ rows: [] }}
              variant="project"
              canCreate={canWrite}
              createLabel="+ 새 프로젝트"
              readOnly={!canWrite}
              onPersist={onPersistProject}
            />
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="space-y-7 p-7">
      <div
        className={`border-b border-line pb-7 transition-[padding] duration-[var(--drawer-ms)] ease-[var(--drawer-ease)] ${
          inspectorOpen ? "md:pr-[340px]" : ""
        }`}
      >
        <GanttChart items={ganttItems} />
      </div>

      <div>
        <header className="mb-3">
          <h3 className="text-base font-bold text-ink">프로젝트</h3>
          <p className="text-xs text-muted">
            행을 클릭하면 하위 업무 목록이 아래에 표시됩니다.
          </p>
        </header>
        <ListPattern
          title="프로젝트"
          data={{ rows: projectRows }}
          variant="project"
          canCreate={canWrite}
          createLabel="+ 새 프로젝트"
          readOnly={!canWrite}
          onSelectRow={(row) => setSelectedProjectId(row.id)}
          onInspectorChange={setInspectorOpen}
          onPersist={async (row, isNew) => {
            const r = await onPersistProject(row, isNew);
            if (r.ok && !isNew) setSelectedProjectId(row.id);
            return r;
          }}
        />
      </div>

      {selectedProjectId ? (
        <div>
          <header className="mb-3">
            <h3 className="text-base font-bold text-ink">하위 업무</h3>
            <p className="text-xs text-muted">
              선택된 프로젝트의 task 1단계만 표시됩니다.
            </p>
          </header>
          <ListPattern
            title="하위 업무"
            data={{ rows: selectedTasks }}
            variant="project-task"
            canCreate={canWrite}
            createLabel="+ 새 하위 업무"
            readOnly={!canWrite}
            onInspectorChange={setInspectorOpen}
            onPersist={async (row, isNew) =>
              onPersistTask(
                { ...row, projectId: row.projectId ?? selectedProjectId },
                isNew,
              )
            }
          />
        </div>
      ) : null}
    </section>
  );
}
