"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { ChecklistItem, ItemStatus } from "@/features/checklist/schemas";
import { STATUSES } from "@/features/checklist/schemas";
import {
  fillUpdateItem,
  fillAddItem,
  fillDeleteItem,
} from "@/features/checklist/fill-actions";
import { STATUS_LABEL, STATUS_STYLE } from "./status-ui";

type SaveState = "idle" | "saving" | "saved" | "error";

/** 부서 작성 폼 — dept-fill 토큰 링크. 상태 칩 즉시저장 + 메모 디바운스 저장 + 항목 추가/삭제. */
export function FillForm({
  token,
  department,
  roundTitle,
  periodStart,
  periodEnd,
  items,
}: {
  token: string;
  department: string;
  roundTitle: string;
  periodStart: string | null;
  periodEnd: string | null;
  items: ChecklistItem[];
}) {
  const router = useRouter();
  const categories = Array.from(new Set(items.map((i) => i.category)));

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <header className="border-b-2 border-vermilion pb-4">
        <p className="text-xs uppercase tracking-[0.06em] text-muted">
          [운영부 상황실] · 원서접수 점검 체크리스트
        </p>
        <h1 className="mt-2 text-2xl font-bold text-ink">{roundTitle}</h1>
        <p className="mt-1 text-sm text-muted">
          {periodStart ?? "-"} ~ {periodEnd ?? "-"}
        </p>
        <div className="mt-3 inline-block bg-vermilion px-3 py-1 text-sm font-bold text-cream">
          {department}
        </div>
        <p className="mt-3 text-xs text-muted">
          각 항목의 상태와 메모를 입력하면 자동 저장됩니다. 다 마치면 창을 닫으면
          됩니다.
        </p>
      </header>

      {categories.length === 0 ? (
        <p className="mt-10 text-center text-sm text-muted">
          아직 항목이 없습니다. 아래 버튼으로 추가하세요.
        </p>
      ) : null}

      {categories.map((cat) => (
        <section key={cat} className="mt-6">
          <h2 className="mb-2 text-sm font-semibold text-ink">
            {cat || "(분야 없음)"}
          </h2>
          <div className="space-y-2">
            {items
              .filter((i) => i.category === cat)
              .map((i) => (
                <FillRow
                  key={i.id}
                  token={token}
                  item={i}
                  onDeleted={() => router.refresh()}
                />
              ))}
          </div>
          <AddRow
            token={token}
            category={cat}
            onAdded={() => router.refresh()}
          />
        </section>
      ))}

      {categories.length === 0 ? (
        <div className="mt-4 text-center">
          <AddRow token={token} category="" onAdded={() => router.refresh()} />
        </div>
      ) : null}
    </div>
  );
}

function SaveBadge({ state }: { state: SaveState }) {
  if (state === "saving")
    return <span className="text-2xs text-muted">저장 중…</span>;
  if (state === "saved")
    return <span className="text-2xs text-sage">✓ 저장됨</span>;
  if (state === "error")
    return <span className="text-2xs text-vermilion">저장 실패</span>;
  return null;
}

function FillRow({
  token,
  item,
  onDeleted,
}: {
  token: string;
  item: ChecklistItem;
  onDeleted: () => void;
}) {
  const [status, setStatus] = useState<ItemStatus | null>(item.status);
  const [note, setNote] = useState(item.note);
  const [save, setSave] = useState<SaveState>("idle");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const persist = async (patch: Record<string, unknown>) => {
    setSave("saving");
    const r = await fillUpdateItem(token, item.id, patch);
    setSave(r.ok ? "saved" : "error");
  };

  const onStatus = (s: ItemStatus) => {
    const next = status === s ? null : s;
    setStatus(next);
    persist({ status: next });
  };

  const onNote = (v: string) => {
    setNote(v);
    setSave("saving");
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => persist({ note: v }), 800);
  };
  const flushNote = () => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
      persist({ note });
    }
  };

  return (
    <div className="border border-line-soft bg-situation-bg p-3">
      <div className="flex items-start justify-between gap-2">
        <span className="text-sm text-ink">{item.title}</span>
        <SaveBadge state={save} />
      </div>
      <div className="mt-2 flex flex-wrap gap-1">
        {STATUSES.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => onStatus(s)}
            className={`border px-2 py-1 text-xs transition-colors ${
              status === s
                ? STATUS_STYLE[s]
                : "border-line-soft text-muted hover:bg-line-soft"
            }`}
          >
            {STATUS_LABEL[s]}
          </button>
        ))}
        <button
          type="button"
          onClick={async () => {
            await fillDeleteItem(token, item.id);
            onDeleted();
          }}
          className="ml-auto px-2 py-1 text-xs text-muted hover:text-vermilion"
        >
          삭제
        </button>
      </div>
      <input
        value={note}
        onChange={(e) => onNote(e.target.value)}
        onBlur={flushNote}
        placeholder="메모"
        className="mt-2 w-full border border-line-soft bg-field-bg px-2 py-1 text-xs transition-colors focus:border-ink focus:bg-white"
      />
    </div>
  );
}

function AddRow({
  token,
  category,
  onAdded,
}: {
  token: string;
  category: string;
  onAdded: () => void;
}) {
  const [busy, setBusy] = useState(false);
  return (
    <button
      type="button"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        await fillAddItem(token, category, "새 항목");
        setBusy(false);
        onAdded();
      }}
      className="mt-2 text-xs text-vermilion hover:underline disabled:opacity-50"
    >
      ＋ 항목 추가
    </button>
  );
}
