"use client";

import { useState, type Dispatch, type SetStateAction } from "react";
import type { ListRow } from "../../../patterns/ListPattern";
import { SERVICE_KINDS } from "@/features/assignments/schemas";

type ServiceRec = NonNullable<ListRow["assignment"]>["byService"][string];
type Cell = NonNullable<ServiceRec["cells"]>[number];

type Props = {
  row: ListRow;
  setRow: Dispatch<SetStateAction<ListRow>>;
  onSave: (next: ListRow) => void;
  onCancel: () => void;
  /**
   * 운영 칸 후보 — **active 운영자만**(`assignmentCandidates`). 개발 칸에는 쓰지
   * 않는다(자유 입력). 이력의 이름 풀이·되돌리기 판정은 명부 전원을 보는 별개 목록이다.
   */
  assignmentCandidates?: { email: string; name: string }[];
};

/** 칸을 가리키는 이름. 하위유형이 없는 업무는 그 자리를 비운다. */
const cellLabel = (kind: string, c: Cell) =>
  c.subtype ? `${kind} ${c.subtype} ${c.role}` : `${kind} ${c.role}`;

/** 한 대학 안에서 칸을 가르는 키. */
const cellKey = (kind: string, c: Cell) => [kind, c.subtype, c.role].join("|");

/**
 * 한 칸만 바꾼 새 행. **원본을 건드리지 않는다** — 같은 배열을 제자리에서 고치면
 * React 가 바뀐 줄 모르고, 취소해도 되돌아오지 않는다.
 */
function withCell(
  row: ListRow,
  kind: string,
  index: number,
  patch: Partial<Cell>,
): ListRow {
  const byService = row.assignment?.byService ?? {};
  const rec = byService[kind];
  if (!rec?.cells || !row.assignment) return row;
  return {
    ...row,
    assignment: {
      ...row.assignment,
      byService: {
        ...byService,
        [kind]: {
          ...rec,
          cells: rec.cells.map((c, i) =>
            i === index ? { ...c, ...patch } : c,
          ),
        },
      },
    },
  };
}

/** 폼을 열었을 때 각 칸을 들고 있던 사람. 칸을 고쳐도 이 스냅샷은 안 바뀐다. */
function initialHoldersOf(row: ListRow) {
  const m = new Map<string, { email: string; name: string }>();
  for (const [kind, rec] of Object.entries(row.assignment?.byService ?? {})) {
    for (const c of rec.cells ?? []) {
      if (c.email) m.set(cellKey(kind, c), { email: c.email, name: c.name });
    }
  }
  return m;
}

/**
 * 배정 편집 — **담당자 교체·비우기만** 한다.
 *
 * 새 칸은 만들지 않는다: (업무종류 × 하위유형) 유효 조합 표가 없어서 열면 오타가
 * 아무도 안 보는 칸을 만든다. 원장은 방금 총괄장에서 왔으므로 실제 배정에는 이미
 * 칸이 있다.
 *
 * 운영 칸은 **명부에서 고른다** — 이력의 단위가 이메일이라 이름만 바꾸면 이력이 안
 * 남는다. 개발 칸은 자유 입력이고, 그래서 개발 칸 편집은 이력에 남지 않는다
 * (`operators` 는 운영부 표라 개발자가 들어갈 자리가 없다 · 사용자 결정 2026-09-17).
 *
 * 서버는 이 폼을 믿지 않는다(`updateAssignment`가 이전값을 DB에서 다시 읽는다).
 */
export function AssignmentsEditForm({
  row,
  setRow,
  onSave,
  onCancel,
  assignmentCandidates = [],
}: Props) {
  /**
   * **폼을 열었을 때의 담당자를 기억한다.** 후보(active)에서 빠진 사람이 칸을 들고
   * 있을 수 있는데, 후보에 없으면 select 값이 어느 옵션과도 안 맞아 `비움` 으로 보이고
   * 이름 힌트는 이메일이 없을 때만 뜨므로 **이름까지 사라진다.** 현재 행에서 읽으면
   * 다른 사람으로 한 번 바꾼 순간 그 사람을 잃어 되돌릴 수 없다.
   */
  const [initialHolders] = useState(() => initialHoldersOf(row));

  const byService = row.assignment?.byService ?? {};
  const kinds = SERVICE_KINDS.filter((k) => (byService[k]?.cells ?? []).length);

  const nameByEmail = new Map(
    assignmentCandidates.map((o) => [o.email, o.name]),
  );
  for (const held of initialHolders.values()) {
    if (!nameByEmail.has(held.email)) nameByEmail.set(held.email, held.name);
  }

  /** 그 칸의 후보 — 후보 밖 현재 담당자는 맨 앞에 남긴다. */
  const optionsOf = (kind: string, cell: Cell) => {
    const base = assignmentCandidates.map((o) => ({
      email: o.email,
      label: o.name,
    }));
    const held = initialHolders.get(cellKey(kind, cell));
    if (held && !assignmentCandidates.some((o) => o.email === held.email)) {
      return [
        { email: held.email, label: `${held.name || held.email} (지금 담당)` },
        ...base,
      ];
    }
    return base;
  };

  return (
    <div className="flex flex-col gap-4 p-5">
      <div>
        <h2 className="text-lg font-medium text-ink">{row.name}</h2>
        {row.assignment && (
          <p className="text-xs text-muted tabular-nums">
            {row.assignment.academicYear}학년도
          </p>
        )}
      </div>

      {kinds.length === 0 ? (
        <p className="text-sm text-muted">
          고칠 칸이 없습니다 — 이 대학은 원장에 배정 칸이 없습니다.
        </p>
      ) : (
        kinds.map((kind) => (
          <section key={kind} className="border-b border-line-soft pb-3">
            <h3 className="mb-1.5 text-sm font-medium text-vermilion">
              {kind}
            </h3>
            <div className="flex flex-col gap-2">
              {(byService[kind]?.cells ?? []).map((cell, i) => {
                const id = `assignment-${kind}-${cell.subtype}-${cell.role}`;
                const label = cellLabel(kind, cell);
                return (
                  <div key={id} className="flex items-center gap-2">
                    <label
                      htmlFor={id}
                      className="w-24 shrink-0 text-xs text-muted"
                    >
                      {cell.subtype
                        ? `${cell.subtype} ${cell.role}`
                        : cell.role}
                    </label>
                    {cell.role === "운영" ? (
                      <>
                        <select
                          id={id}
                          aria-label={label}
                          value={cell.email ?? ""}
                          onChange={(e) => {
                            const email = e.target.value;
                            setRow((prev) =>
                              withCell(prev, kind, i, {
                                email: email === "" ? null : email,
                                name: nameByEmail.get(email) ?? "",
                              }),
                            );
                          }}
                          className="min-w-0 flex-1 border border-line-soft bg-field-bg px-2 py-1 text-sm text-ink focus:border-ink focus:bg-white"
                        >
                          <option value="">— 비움 —</option>
                          {optionsOf(kind, cell).map((o) => (
                            <option key={o.email} value={o.email}>
                              {o.label}
                            </option>
                          ))}
                        </select>
                        {/*
                          이메일을 못 맞춘 칸은 select 가 '비움' 으로 보인다(값이 없다).
                          이름까지 지우면 원래 미배정이었는지 미매칭이었는지 구분할 수
                          없다 — 고칠 사람은 그 이름으로 누구였는지 안다.
                        */}
                        {!cell.email && cell.name && (
                          <span className="shrink-0 text-2xs text-muted">
                            지금 {cell.name} · 연결 안 됨
                          </span>
                        )}
                      </>
                    ) : (
                      <input
                        id={id}
                        aria-label={label}
                        type="text"
                        value={cell.name}
                        placeholder="개발자 이름"
                        onChange={(e) =>
                          setRow((prev) =>
                            withCell(prev, kind, i, { name: e.target.value }),
                          )
                        }
                        className="min-w-0 flex-1 border border-line-soft bg-field-bg px-2 py-1 text-sm text-ink focus:border-ink focus:bg-white"
                      />
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        ))
      )}

      <p className="text-2xs text-muted">
        개발 칸은 이름만 둔다 — 개발자는 운영부 명부에 없어 변경 이력이 남지
        않는다.
      </p>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => onSave(row)}
          className="cursor-pointer border border-line px-3 py-1 text-xs text-ink transition-colors hover:border-ink hover:bg-ink hover:text-cream"
        >
          저장
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="cursor-pointer border border-line px-3 py-1 text-xs text-ink transition-colors hover:border-ink hover:bg-ink hover:text-cream"
        >
          취소
        </button>
      </div>
    </div>
  );
}
