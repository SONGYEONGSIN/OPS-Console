"use client";

import { useState } from "react";
import type {
  ChecklistItem,
  Department,
  ItemStatus,
} from "@/features/checklist/schemas";
import { STATUSES, deptLabel } from "@/features/checklist/schemas";
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

// 상태 칩 표준(작성폼과 동일): 기본 흰 배경 + 호버 빨강, 선택 시 버밀리언 틴트. 삭제는 기본 빨강 버튼.
const CHIP_BASE = "border px-2 py-1 text-xs transition-colors";
const CHIP_ON = "border-vermilion bg-vermilion/10 text-vermilion";
const CHIP_OFF =
  "border-line bg-paper text-ink hover:border-vermilion hover:text-vermilion";
const DELETE_BTN =
  "border border-vermilion bg-vermilion px-2 py-1 text-xs text-cream transition-colors hover:opacity-90";

type Props = {
  roundId: string;
  department: Department;
  items: ChecklistItem[];
};

/**
 * 회차 상세 — 부서 섹션: 분야별 그룹 + 항목 행(제목·상태칩·삭제 한 줄 + 메모 전폭 + 첨부) + 항목 추가.
 * 작성폼(공개 fill)과 동일 내용·스타일로 표시 — 부서가 작성한 메모/이미지가 여기서도 보인다.
 */
export function ItemManager({ roundId, department, items }: Props) {
  const cats = Array.from(new Set(items.map((i) => i.category)));
  return (
    <section>
      <h2 className="border-b-2 border-ink pb-1.5 text-base font-bold text-ink">
        {deptLabel(department)}
      </h2>
      {cats.map((cat) => (
        <div key={cat} className="mt-3">
          <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted">
            {cat || "(분야 없음)"}
          </p>
          <div className="space-y-2">
            {items
              .filter((i) => i.category === cat)
              .map((i) => (
                <Row key={i.id} roundId={roundId} item={i} />
              ))}
          </div>
          <button
            type="button"
            onClick={() => addItemAction(roundId, department, cat)}
            className="mt-2 text-xs text-vermilion hover:underline"
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

  const onStatus = (s: ItemStatus) => {
    const next = status === s ? null : s;
    setStatus(next);
    updateItemAction(item.id, { status: next });
  };

  return (
    <div className="border border-line-soft bg-paper p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="text-sm text-ink">{item.title}</div>
        <div className="flex flex-wrap items-center justify-end gap-1">
          {STATUSES.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => onStatus(s)}
              className={`${CHIP_BASE} ${status === s ? CHIP_ON : CHIP_OFF}`}
            >
              {LABEL[s]}
            </button>
          ))}
          <button
            type="button"
            onClick={() => deleteItemAction(item.id, roundId)}
            className={DELETE_BTN}
          >
            삭제
          </button>
        </div>
      </div>
      {item.note ? (
        <div
          className="mt-2 whitespace-pre-wrap border border-line-soft bg-field-bg px-2 py-1.5 text-sm text-ink [&_img]:my-1 [&_img]:max-w-full [&_img]:rounded [&_img]:border [&_img]:border-line-soft"
          dangerouslySetInnerHTML={{ __html: item.note }}
        />
      ) : (
        <div className="mt-2 text-xs text-muted">메모 없음</div>
      )}
      {item.attachments.length > 0 ? (
        <div className="mt-2 flex flex-wrap gap-2">
          {item.attachments.map((url) => (
            <a key={url} href={url} target="_blank" rel="noopener noreferrer">
              <img
                src={url}
                alt="첨부 이미지"
                className="h-20 w-20 rounded border border-line-soft object-cover"
              />
            </a>
          ))}
        </div>
      ) : null}
    </div>
  );
}
