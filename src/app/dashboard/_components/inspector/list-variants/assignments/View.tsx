"use client";

import { useState } from "react";
import type { ListRow } from "../../../patterns/ListPattern";
import { SERVICE_KINDS } from "@/features/assignments/schemas";
import type {
  AssignmentChange,
  AssignmentChangeSource,
} from "@/features/assignments/ledger-schemas";
import {
  latestPerCell,
  revertBlockedReason,
} from "@/features/assignments/revert";
import { kstDateTime } from "@/lib/kst-format";
import { ASSIGNMENT_BADGE_TONE } from "./status";

type ServiceRec = NonNullable<ListRow["assignment"]>["byService"][string];
type Cell = NonNullable<ServiceRec["cells"]>[number];

/**
 * 하위유형으로 묶는다 — **라벨은 묶음마다 한 번**이다. 칸마다 적으면 운영·개발
 * 짝에서 같은 라벨이 두 줄로 겹쳐 보인다. 칸 순서는 매퍼가 이미 정렬했으므로
 * (`sortCells`) 들어온 순서를 그대로 쓴다.
 */
function groupBySubtype(cells: readonly Cell[]) {
  const out = new Map<string, Cell[]>();
  for (const c of cells) {
    out.set(c.subtype, [...(out.get(c.subtype) ?? []), c]);
  }
  return [...out];
}

/**
 * 원장 칸 목록. **접지 않는다** — 자연키 하나가 한 줄이다.
 *
 * `연결 안 됨` 은 **운영 칸에만** 붙는다. 개발 칸은 언제나 메일이 없어서
 * (`operators` 가 운영부 표다) 거기에 붙이면 늘 뜨는 경고가 되고, 늘 뜨는 경고는
 * 고칠 수 있는 운영 칸을 덮는다(#1195).
 */
function CellList({ cells }: { cells: readonly Cell[] }) {
  return (
    <ul className="mt-1.5 flex flex-col gap-1.5">
      {groupBySubtype(cells).map(([subtype, group]) => (
        <li key={subtype} className="flex items-baseline gap-2">
          {subtype !== "" && (
            <span className="w-10 shrink-0 text-xs text-muted">{subtype}</span>
          )}
          <div className="flex flex-col gap-0.5">
            {group.map((c, i) => (
              <div key={i} className="flex items-baseline gap-2 text-sm">
                <span className="w-7 shrink-0 text-xs text-muted">
                  {c.role}
                </span>
                <span className="text-ink">{c.name || "—"}</span>
                {c.role === "운영" &&
                  (c.email ? (
                    <span className="font-mono text-xs text-muted">
                      {c.email}
                    </span>
                  ) : (
                    <span
                      className={`px-1.5 py-0.5 text-2xs ${ASSIGNMENT_BADGE_TONE["연결 안 됨"]}`}
                    >
                      연결 안 됨
                    </span>
                  ))}
              </div>
            ))}
          </div>
        </li>
      ))}
    </ul>
  );
}

/** 이력 한 줄이 어디서 왔나. 되돌리기도 하나의 출처다(삭제가 아니라 새 행). */
const SOURCE_LABEL: Record<AssignmentChangeSource, string> = {
  import: "이관",
  manual: "수동",
  proposal: "제안",
  revert: "되돌림",
};

/**
 * 변경 이력 — **"이 칸이 왜 이 사람인가" 에 답하는 자리**다.
 *
 * **표로 그리지 않는다.** 인스펙터는 340px 이라 자연키 5칸 + 방향 + 시각을 표로 놓으면
 * 가로로 넘치고, 넘치면 가로 스크롤 안에서 되돌리기 버튼이 사라진다.
 *
 * 이력은 **이메일 단위**라 이름 스냅샷이 없다. 명부에 있으면 이름으로 풀고, 없으면
 * 주소를 그대로 보여준다 — 그 주소가 사라진 것이 곧 되돌리기가 막히는 이유다(F14).
 */
function ChangeHistory({
  changes,
  operators,
  onRevert,
}: {
  changes: readonly AssignmentChange[];
  operators: readonly { email: string; name: string }[];
  onRevert?: (id: string) => Promise<{ ok: boolean; error?: string }>;
}) {
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const nameByEmail = new Map(operators.map((o) => [o.email, o.name]));
  const knownEmails = new Set(operators.map((o) => o.email));
  const latestIds = latestPerCell(changes);
  // 조회가 최신순으로 주지만 그 정렬에 화면을 얹지 않는다 — 한 줄만 바뀌어도
  // 이력이 뒤집혀 보인다.
  const sorted = [...changes].sort((a, b) =>
    a.changed_at < b.changed_at ? 1 : a.changed_at > b.changed_at ? -1 : 0,
  );

  const who = (email: string | null) =>
    email === null ? "미배정" : (nameByEmail.get(email) ?? email);

  return (
    <section>
      <h3 className="mb-1.5 text-sm font-medium text-vermilion">변경 이력</h3>
      {sorted.length === 0 ? (
        <p className="text-xs text-muted">
          아직 없습니다 — 배정을 고치면 여기에 한 줄씩 쌓입니다.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {sorted.map((c) => {
            const reason = onRevert
              ? revertBlockedReason(c, { latestIds, knownEmails })
              : null;
            return (
              <li
                key={c.id}
                className="flex flex-col gap-0.5 border-b border-line-soft pb-1.5"
              >
                <div className="flex items-baseline gap-2">
                  <span className="text-xs text-muted">
                    {`${c.work_kind}${c.subtype ? ` · ${c.subtype}` : ""} · ${c.role}`}
                  </span>
                  <span className="text-2xs text-muted">
                    {SOURCE_LABEL[c.source] ?? c.source}
                  </span>
                </div>
                <p className="text-sm text-ink">
                  {`${who(c.prev_assignee)} → ${who(c.next_assignee)}`}
                </p>
                <div className="flex items-baseline gap-2">
                  <time className="text-2xs text-muted tabular-nums">
                    {kstDateTime(c.changed_at)}
                  </time>
                  {onRevert &&
                    (reason ? (
                      // 버튼만 사라지면 왜 못 되돌리는지 모른다.
                      <span className="text-2xs text-muted">{reason}</span>
                    ) : (
                      <button
                        type="button"
                        disabled={pendingId !== null}
                        onClick={async () => {
                          setPendingId(c.id);
                          setError(null);
                          try {
                            const r = await onRevert(c.id);
                            if (!r.ok)
                              setError(r.error ?? "되돌리지 못했습니다");
                          } finally {
                            setPendingId(null);
                          }
                        }}
                        className="cursor-pointer border border-line px-2 py-0.5 text-2xs text-ink transition-colors hover:border-ink hover:bg-ink hover:text-cream"
                      >
                        되돌리기
                      </button>
                    ))}
                </div>
              </li>
            );
          })}
        </ul>
      )}
      {error && <p className="mt-1 text-xs text-vermilion">{error}</p>}
    </section>
  );
}

type Props = {
  row: ListRow;
  /** 이 대학의 변경 이력. **없으면 섹션 자체를 안 그린다** — 안 넘긴 화면에 빈 칸이 생긴다. */
  assignmentChanges?: AssignmentChange[];
  /** 이메일 → 이름 풀이용. 이력에는 이름 스냅샷이 없다. */
  assignmentOperators?: { email: string; name: string }[];
  /** 되돌리기(admin only). 없으면 버튼을 안 그린다 — 이력 자체는 전원 공개다. */
  onRevertChange?: (id: string) => Promise<{ ok: boolean; error?: string }>;
};

export function AssignmentsView({
  row,
  assignmentChanges,
  assignmentOperators = [],
  onRevertChange,
}: Props) {
  const bs = row.assignment?.byService ?? {};
  const cells = Object.values(bs).flatMap((r) => r.cells ?? []);
  const hasDeveloperCell = cells.some((c) => c.role === "개발");

  return (
    <div className="flex flex-col gap-5 p-5">
      <header>
        <h2 className="text-lg font-medium text-ink">{row.name}</h2>
        {row.assignment && (
          <p className="text-xs text-muted tabular-nums">
            {row.assignment.academicYear}학년도
          </p>
        )}
      </header>
      {SERVICE_KINDS.map((s) => {
        const rec = bs[s];
        if (!rec) return null;
        return (
          <section key={s} className="border-b border-line-soft pb-3">
            <h3 className="mb-1 text-sm font-medium text-vermilion">{s}</h3>
            {rec.cells && rec.cells.length > 0 ? (
              <CellList cells={rec.cells} />
            ) : (
              // 시트를 읽던 경로. `_row-mapper` 와 함께 A10 에서 사라진다(임시).
              <p className="text-sm text-ink">
                운영 {rec.operator || "—"}
                {rec.developer ? ` · 개발 ${rec.developer}` : ""}
              </p>
            )}
            {rec.detail.length > 0 && (
              <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-xs text-muted">
                {rec.detail.map((d, i) => (
                  <div key={i} className="contents">
                    <dt>{d.label}</dt>
                    <dd className="text-ink">{d.value}</dd>
                  </div>
                ))}
              </dl>
            )}
          </section>
        );
      })}
      {hasDeveloperCell && (
        <p className="text-xs text-muted">
          개발 칸은 이름만 둔다 — 개발자는 운영부 명부에 없어 메일이 붙지
          않는다.
        </p>
      )}
      {assignmentChanges && (
        <ChangeHistory
          changes={assignmentChanges}
          operators={assignmentOperators}
          onRevert={onRevertChange}
        />
      )}
    </div>
  );
}
