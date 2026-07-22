"use client";

import { useState } from "react";
import type {
  ChecklistItem,
  Department,
  ItemStatus,
} from "@/features/checklist/schemas";
import { STATUSES } from "@/features/checklist/schemas";
import {
  updateItemAction,
  addItemAction,
  deleteItemAction,
} from "@/features/checklist/actions";

const LABEL: Record<ItemStatus, string> = {
  done: "완료",
  in_progress: "진행중",
  todo: "작업전",
  na: "해당없음",
};

type Props = {
  roundId: string;
  department: Department;
  items: ChecklistItem[];
};

/**
 * 회차 상세 — 부서 섹션: 분야별 그룹 + 항목 행(상태칩/메모/삭제) + 항목 추가.
 * admin 전용 편집 — 전 부서 항목 편집 가능 (공개 fill 폼은 Plan 2).
 */
export function ItemManager({ roundId, department, items }: Props) {
  const cats = Array.from(new Set(items.map((i) => i.category)));
  return (
    <section>
      <h2 className="border-b-2 border-ink pb-1.5 text-base font-bold text-ink">
        {department}
      </h2>
      {cats.map((cat) => (
        <div key={cat} className="mt-3">
          <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted">
            {cat || "(분야 없음)"}
          </p>
          {items
            .filter((i) => i.category === cat)
            .map((i) => (
              <Row key={i.id} roundId={roundId} item={i} />
            ))}
          <button
            type="button"
            onClick={() => addItemAction(roundId, department, cat)}
            className="mt-1 text-xs text-vermilion"
          >
            ＋ 항목 추가
          </button>
        </div>
      ))}
    </section>
  );
}

function Row({ roundId, item }: { roundId: string; item: ChecklistItem }) {
  const [status, setStatus] = useState<ItemStatus | null>(item.status);
  const [note, setNote] = useState(item.note);
  return (
    <div className="mb-[-1px] grid grid-cols-[1fr_auto] items-start gap-3 border border-line-soft bg-situation-bg p-3">
      <div>
        <div className="text-sm">{item.title}</div>
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          onBlur={() => updateItemAction(item.id, { note })}
          placeholder="메모"
          className="mt-1 w-full border border-line-soft bg-field-bg px-2 py-1 text-xs focus:border-ink focus:bg-white"
        />
      </div>
      <div className="flex flex-wrap gap-1">
        {STATUSES.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => {
              setStatus(s);
              updateItemAction(item.id, { status: s });
            }}
            className={`border px-2 py-1 text-xs ${
              status === s
                ? "border-vermilion bg-vermilion/10 text-vermilion"
                : "border-line text-muted hover:bg-line-soft"
            }`}
          >
            {LABEL[s]}
          </button>
        ))}
        <button
          type="button"
          onClick={() => deleteItemAction(item.id, roundId)}
          className="px-1 text-xs text-muted"
        >
          삭제
        </button>
      </div>
    </div>
  );
}
