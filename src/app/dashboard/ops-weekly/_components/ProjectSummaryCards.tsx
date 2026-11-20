"use client";

import type { Area, ProjectKind } from "@/features/ops-weekly/constants";
import type { ProjectEntryView } from "@/features/ops-weekly/merge";
import { useProjectDrawer } from "./project-drawer-context";
import { ROW_BTN_CLASS } from "./styles";

type Props = {
  entries: readonly ProjectEntryView[];
  checked: readonly Area[];
  editable: boolean;
};

const KINDS: readonly ProjectKind[] = ["project", "tf"];
const NAME: Record<ProjectKind, string> = { project: "프로젝트", tf: "TF" };

function isBlank(html: string): boolean {
  if (/<img/i.test(html)) return false;
  return (
    html
      .replace(/<[^>]*>/g, "")
      .replace(/&nbsp;/g, " ")
      .trim() === ""
  );
}

/** 그 종류 항목 중 금주 칸이 빈 것의 수 — 그림만 있는 칸은 채운 것이다. */
export function remainingOf(
  entries: readonly ProjectEntryView[],
  kind: ProjectKind,
): number {
  return entries.filter((e) => e.kind === kind && isBlank(e.thisWeek)).length;
}

function SummaryCard(props: Props & { kind: ProjectKind }) {
  const { entries, checked, editable, kind } = props;
  const { open } = useProjectDrawer();
  const total = entries.filter((e) => e.kind === kind).length;
  const left = remainingOf(entries, kind);
  return (
    <div className="flex min-w-0 flex-1 flex-col gap-2 border border-line-soft bg-situation-bg p-3">
      <span className="text-sm font-bold text-ink">
        {checked.includes(kind) ? `${NAME[kind]} ✓` : NAME[kind]}
      </span>
      <span className="text-xs tabular-nums text-muted">
        {left > 0 ? `${total}건 · ${left}건 남음` : `${total}건`}
      </span>
      <button
        type="button"
        onClick={() => {
          open(kind);
        }}
        className={`${ROW_BTN_CLASS} self-start`}
      >
        {editable ? "쓰기" : "보기"}
      </button>
    </div>
  );
}

/** 쓸 것 패널의 프로젝트·TF 카드 둘 — 버튼이 넓은 서랍을 연다. */
export function ProjectSummaryCards(props: Props) {
  return (
    <div className="flex flex-wrap gap-3">
      {KINDS.map((kind) => (
        <SummaryCard key={kind} {...props} kind={kind} />
      ))}
    </div>
  );
}
