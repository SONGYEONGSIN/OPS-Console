"use client";

import { useMemo, useState } from "react";
import type { ProjectRow, ProjectTaskRow } from "@/features/projects/schemas";
import { operatorNameByEmail } from "@/features/auth/operators";
import { ListPattern } from "../_components/patterns/ListPattern";
import type { ListRow } from "../_components/patterns/ListPattern";
import { GanttChart } from "./GanttChart";

type PersistResult = { ok: boolean; error?: string };

export type ProjectWithTasksView = {
  project: ProjectRow;
  tasks: ProjectTaskRow[];
};

/**
 * 선택된 프로젝트 id를 현재 목록과 대조해 유효한 값으로 보정.
 * 선택 id가 목록에 없으면(삭제·revalidate로 사라짐) 첫 프로젝트로 폴백.
 * 하위 업무 추가 시 존재하지 않는 project_id가 넘어가 FK 위반이 나는 것을 방지.
 */
export function resolveEffectiveProjectId(
  selectedId: string | null,
  projectsWithTasks: ProjectWithTasksView[],
): string | null {
  if (
    selectedId &&
    projectsWithTasks.some((pwt) => pwt.project.id === selectedId)
  ) {
    return selectedId;
  }
  return projectsWithTasks[0]?.project.id ?? null;
}

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
    owner: operatorNameByEmail(p.owner_email),
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
    owner: operatorNameByEmail(t.assignee_email),
    priority: t.priority,
    progress: t.progress,
    todoStatus: t.status,
    startDateYmd: t.start_at ?? null,
    endDateYmd: t.end_at ?? null,
    taskAssigneeEmail: t.assignee_email ?? null,
    taskChecklist: t.checklist,
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
  // 선택 id가 stale(삭제됨)이면 첫 프로젝트로 보정 — 존재하지 않는 project_id로
  // 하위 업무를 추가해 FK 위반이 나는 것을 방지한다.
  const effectiveSelectedId = resolveEffectiveProjectId(
    selectedProjectId,
    projectsWithTasks,
  );
  // 두 ListPattern을 분리 추적 — 각 ListPattern은 자체 drawerPadding이 있어서
  // outer 통합 padding과 누적되면 컬럼이 wrap된다 (테이블이 너무 좁아짐).
  // 선택된 ListPattern은 자체 drawerPadding만 / 다른 영역만 outer padding 적용.
  const [projectInspectorOpen, setProjectInspectorOpen] = useState(false);
  const [taskInspectorOpen, setTaskInspectorOpen] = useState(false);
  const anyInspectorOpen = projectInspectorOpen || taskInspectorOpen;

  const projectRows: ListRow[] = projectsWithTasks.map((pwt) =>
    projectToListRow(pwt.project, pwt.tasks),
  );

  const selectedTasks = useMemo(() => {
    const found = projectsWithTasks.find(
      (pwt) => pwt.project.id === effectiveSelectedId,
    );
    return found?.tasks.map(taskToListRow) ?? [];
  }, [projectsWithTasks, effectiveSelectedId]);

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
        {/* text-center를 안내문에만 적용 — 이전: 부모 div에 적용해 ListPattern → InspectorChrome 안의
            EditForm 라벨까지 inheritance로 가운데 정렬되는 버그. ListPattern wrap은 별도 flex로 가운데만. */}
        <div className="border border-line-soft bg-situation-bg p-12">
          <p className="text-center text-base text-ink">프로젝트 없음</p>
          <p className="mt-2 text-center text-xs text-muted">
            아래 &lsquo;+ 새 프로젝트&rsquo; 버튼으로 시작하세요.
          </p>
          <div className="mt-4 flex justify-center">
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
          anyInspectorOpen ? "md:pr-[340px]" : ""
        }`}
      >
        <GanttChart items={ganttItems} />
      </div>

      {/* 프로젝트 영역 — 자체 drawerPadding은 ListPattern 내부가 처리.
          하위 업무 인스펙터 열림 시에만 외부 padding으로 가려짐 방지. */}
      <div
        className={`transition-[padding] duration-[var(--drawer-ms)] ease-[var(--drawer-ease)] ${
          taskInspectorOpen ? "md:pr-[340px]" : ""
        }`}
      >
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
          onInspectorChange={setProjectInspectorOpen}
          onPersist={async (row, isNew) => {
            const r = await onPersistProject(row, isNew);
            if (r.ok && !isNew) setSelectedProjectId(row.id);
            return r;
          }}
        />
      </div>

      {effectiveSelectedId ? (
        <div
          className={`transition-[padding] duration-[var(--drawer-ms)] ease-[var(--drawer-ease)] ${
            projectInspectorOpen ? "md:pr-[340px]" : ""
          }`}
        >
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
            onInspectorChange={setTaskInspectorOpen}
            onPersist={async (row, isNew) =>
              onPersistTask(
                { ...row, projectId: row.projectId ?? effectiveSelectedId },
                isNew,
              )
            }
          />
        </div>
      ) : null}
    </section>
  );
}
