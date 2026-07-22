"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { ChecklistItem, ItemStatus } from "@/features/checklist/schemas";
import { DEPARTMENTS, STATUSES } from "@/features/checklist/schemas";
import {
  fillUpdateItem,
  fillAddItem,
  fillDeleteItem,
  fillUploadImage,
  fillRemoveAttachment,
} from "@/features/checklist/fill-actions";
import { STATUS_LABEL, STATUS_STYLE } from "./status-ui";

type SaveState = "idle" | "saving" | "saved" | "error";

/**
 * 통합 작성 폼 — fill 토큰 링크(로그인 불필요). 전 부서 항목을 부서→분야로 묶어 노출.
 * 상태 칩 즉시저장 + 메모(textarea·여러 줄) 디바운스 저장 + 항목 추가/삭제.
 */
export function FillForm({
  token,
  roundTitle,
  periodStart,
  periodEnd,
  items,
}: {
  token: string;
  roundTitle: string;
  periodStart: string | null;
  periodEnd: string | null;
  items: ChecklistItem[];
}) {
  const router = useRouter();
  const depts = DEPARTMENTS.filter((d) =>
    items.some((i) => i.department === d),
  );

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <header className="border-b-2 border-vermilion pb-4">
        <p className="text-xs uppercase tracking-[0.06em] text-muted">
          [운영부 상황실] · 원서접수 점검 체크리스트
        </p>
        <h1 className="mt-2 text-2xl font-bold text-ink">{roundTitle}</h1>
        <p className="mt-1 text-sm text-muted">
          {periodStart ?? "-"} ~ {periodEnd ?? "-"}
        </p>
        <p className="mt-3 text-xs text-muted">
          각 부서 항목의 상태와 메모를 입력하면 자동 저장됩니다. 다 마치면 창을
          닫으면 됩니다.
        </p>
      </header>

      {items.length === 0 ? (
        <p className="mt-10 text-center text-sm text-muted">
          아직 등록된 항목이 없습니다.
        </p>
      ) : null}

      {depts.map((dept) => {
        const deptItems = items.filter((i) => i.department === dept);
        const cats = Array.from(new Set(deptItems.map((i) => i.category)));
        return (
          <section key={dept} className="mt-8">
            <h2 className="border-b-2 border-ink pb-1.5 text-base font-bold text-ink">
              {dept}
            </h2>
            {cats.map((cat) => (
              <div key={cat} className="mt-4">
                <p className="mb-2 text-sm font-semibold text-ink">
                  {cat || "(분야 없음)"}
                </p>
                <div className="space-y-2">
                  {deptItems
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
                  department={dept}
                  category={cat}
                  onAdded={() => router.refresh()}
                />
              </div>
            ))}
          </section>
        );
      })}
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
  const [attachments, setAttachments] = useState<string[]>(item.attachments);
  const [uploading, setUploading] = useState(false);
  const [save, setSave] = useState<SaveState>("idle");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const persist = async (patch: Record<string, unknown>) => {
    setSave("saving");
    const r = await fillUpdateItem(token, item.id, patch);
    setSave(r.ok ? "saved" : "error");
  };

  // 클립보드 이미지 붙여넣기 → 업로드 후 썸네일 추가
  const onPaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const file = Array.from(e.clipboardData.items)
      .find((it) => it.type.startsWith("image/"))
      ?.getAsFile();
    if (!file) return;
    e.preventDefault();
    setUploading(true);
    setSave("saving");
    const reader = new FileReader();
    reader.onload = async () => {
      const r = await fillUploadImage(token, item.id, String(reader.result));
      setUploading(false);
      if (r.ok) {
        setAttachments((a) => [...a, r.url]);
        setSave("saved");
      } else setSave("error");
    };
    reader.readAsDataURL(file);
  };

  const removeAttachment = async (url: string) => {
    setAttachments((a) => a.filter((u) => u !== url));
    await fillRemoveAttachment(token, item.id, url);
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
      <textarea
        value={note}
        onChange={(e) => onNote(e.target.value)}
        onBlur={flushNote}
        onPaste={onPaste}
        placeholder="메모 (여러 줄 입력 · 이미지 붙여넣기 가능)"
        rows={2}
        className="mt-2 w-full resize-y border border-line-soft bg-field-bg px-2 py-1 text-xs transition-colors focus:border-ink focus:bg-white"
      />
      {attachments.length > 0 ? (
        <div className="mt-2 flex flex-wrap gap-2">
          {attachments.map((url) => (
            <div key={url} className="relative">
              <a href={url} target="_blank" rel="noopener noreferrer">
                <img
                  src={url}
                  alt="첨부 이미지"
                  className="h-20 w-20 rounded border border-line-soft object-cover"
                />
              </a>
              <button
                type="button"
                onClick={() => removeAttachment(url)}
                aria-label="첨부 삭제"
                className="absolute -right-1.5 -top-1.5 flex size-4 items-center justify-center rounded-full bg-ink text-2xs leading-none text-cream"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      ) : null}
      {uploading ? (
        <p className="mt-1 text-2xs text-muted">이미지 업로드 중…</p>
      ) : null}
    </div>
  );
}

function AddRow({
  token,
  department,
  category,
  onAdded,
}: {
  token: string;
  department: string;
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
        await fillAddItem(token, department, category, "새 항목");
        setBusy(false);
        onAdded();
      }}
      className="mt-2 text-xs text-vermilion hover:underline disabled:opacity-50"
    >
      ＋ 항목 추가
    </button>
  );
}
