"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { RichNote } from "./RichNote";
import type { ChecklistItem, ItemStatus } from "@/features/checklist/schemas";
import {
  DEPARTMENTS,
  STATUSES,
  deptLabel,
  type Department,
} from "@/features/checklist/schemas";
import {
  fillUpdateItem,
  fillAddItem,
  fillDeleteItem,
  fillUploadImage,
  fillRemoveAttachment,
  fillReorderItems,
} from "@/features/checklist/fill-actions";
import { STATUS_LABEL } from "./status-ui";

type SaveState = "idle" | "saving" | "saved" | "error";

// 상태 칩: 기본 흰 배경 + 호버 검정 배경, 선택 시 검정 배경. 삭제는 기본 빨강 버튼.
const CHIP_BASE = "border px-2 py-1 text-xs transition-colors";
const CHIP_ON = "border-ink bg-ink text-cream";
const CHIP_OFF =
  "border-line bg-paper text-ink hover:border-ink hover:bg-ink hover:text-cream";
const DELETE_BTN =
  "border border-vermilion bg-vermilion px-2 py-1 text-xs text-cream transition-colors hover:opacity-90";
// 부서 필터 배지: 기본 흰 배경 + 호버 빨강, 선택 시 빨강 배경.
const BADGE_ON = "border-vermilion bg-vermilion text-cream";
const BADGE_OFF =
  "border-line bg-paper text-ink hover:border-vermilion hover:bg-vermilion hover:text-cream";

/**
 * 통합 작성 폼 — fill 토큰 링크(로그인 불필요). 전 부서 항목을 부서→분야로 묶어 노출.
 * 상단 부서 필터 배지로 자기 부서만 볼 수 있음. 상태 칩 즉시저장 + 메모 디바운스 저장 + 항목 추가/삭제.
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
  const [activeDept, setActiveDept] = useState<Department | null>(null);
  const depts = DEPARTMENTS.filter((d) =>
    items.some((i) => i.department === d),
  );
  const shown = depts.filter((d) => activeDept === null || d === activeDept);

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <header className="border-b-2 border-vermilion pb-4">
        <p className="text-xs uppercase tracking-[0.06em] text-muted">
          어플라이본부 원서접수 점검 진행 상황
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

      {depts.length > 1 ? (
        <div className="mt-3 flex flex-wrap justify-end gap-1">
          <button
            type="button"
            onClick={() => setActiveDept(null)}
            className={`${CHIP_BASE} ${activeDept === null ? BADGE_ON : BADGE_OFF}`}
          >
            전체
          </button>
          {depts.map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => setActiveDept(d)}
              className={`${CHIP_BASE} ${activeDept === d ? BADGE_ON : BADGE_OFF}`}
            >
              {deptLabel(d)}
            </button>
          ))}
        </div>
      ) : null}

      {items.length === 0 ? (
        <p className="mt-10 text-center text-sm text-muted">
          아직 등록된 항목이 없습니다.
        </p>
      ) : null}

      {shown.map((dept) => {
        const deptItems = items.filter((i) => i.department === dept);
        const cats = Array.from(new Set(deptItems.map((i) => i.category)));
        return (
          <section key={dept} className="mt-8">
            <h2 className="border-b-2 border-ink pb-1.5 text-base font-bold text-ink">
              {deptLabel(dept)}
            </h2>
            {cats.map((cat) => {
              const catItems = deptItems.filter((i) => i.category === cat);
              return (
                <div key={cat} className="mt-4">
                  <CategoryLabel
                    token={token}
                    category={cat}
                    itemIds={catItems.map((i) => i.id)}
                    onRenamed={() => router.refresh()}
                  />
                  <CategoryItems
                    token={token}
                    items={catItems}
                    onChanged={() => router.refresh()}
                  />
                  <AddRow
                    token={token}
                    department={dept}
                    category={cat}
                    onAdded={() => router.refresh()}
                  />
                </div>
              );
            })}
            <AddCategoryRow
              token={token}
              department={dept}
              onAdded={() => router.refresh()}
            />
          </section>
        );
      })}
    </div>
  );
}

// 부서에 새 분야 추가 — 새 분야명으로 항목 1개 생성(빈 분야는 렌더되지 않으므로).
function AddCategoryRow({
  token,
  department,
  onAdded,
}: {
  token: string;
  department: string;
  onAdded: () => void;
}) {
  const [busy, setBusy] = useState(false);
  return (
    <div className="mt-3">
      <button
        type="button"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          await fillAddItem(token, department, "새 분야", "새 항목");
          setBusy(false);
          onAdded();
        }}
        className="border border-line bg-paper px-2 py-1 text-xs font-semibold text-ink transition-colors hover:border-vermilion hover:bg-vermilion hover:text-cream disabled:opacity-50"
      >
        ＋ 분야 추가
      </button>
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

// 분야 내 항목 목록 — 드래그 핸들(⠿)로 순서 변경(sort_order 재배분).
function CategoryItems({
  token,
  items,
  onChanged,
}: {
  token: string;
  items: ChecklistItem[];
  onChanged: () => void;
}) {
  const ids = items.map((i) => i.id).join(",");
  const [order, setOrder] = useState<string[]>(() => items.map((i) => i.id));
  const [seen, setSeen] = useState(ids);
  const dragId = useRef<string | null>(null);
  if (ids !== seen) {
    setSeen(ids);
    setOrder(items.map((i) => i.id));
  }

  const byId = new Map(items.map((i) => [i.id, i]));
  const onDrop = async (targetId: string) => {
    const src = dragId.current;
    dragId.current = null;
    if (!src || src === targetId) return;
    const from = order.indexOf(src);
    const to = order.indexOf(targetId);
    if (from < 0 || to < 0) return;
    const next = [...order];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    setOrder(next);
    await fillReorderItems(token, next);
    onChanged();
  };

  return (
    <div className="space-y-2">
      {order.map((id) => {
        const item = byId.get(id);
        if (!item) return null;
        return (
          <div
            key={id}
            onDragOver={(e) => e.preventDefault()}
            onDrop={() => onDrop(id)}
            className="flex items-start gap-1"
          >
            <button
              type="button"
              draggable
              onDragStart={() => {
                dragId.current = id;
              }}
              aria-label="순서 이동"
              className="mt-3 cursor-grab select-none px-1 text-muted hover:text-ink active:cursor-grabbing"
            >
              ⠿
            </button>
            <div className="min-w-0 flex-1">
              <FillRow token={token} item={item} onDeleted={onChanged} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

// 분야(카테고리) 라벨 — 편집 가능. 이름 변경 시 해당 분야의 전 항목 category를 갱신.
function CategoryLabel({
  token,
  category,
  itemIds,
  onRenamed,
}: {
  token: string;
  category: string;
  itemIds: string[];
  onRenamed: () => void;
}) {
  const [val, setVal] = useState(category);
  const commit = async () => {
    const next = val.trim();
    if (!next || next === category) {
      setVal(category);
      return;
    }
    await Promise.all(
      itemIds.map((id) => fillUpdateItem(token, id, { category: next })),
    );
    onRenamed();
  };
  return (
    <input
      value={val}
      onChange={(e) => setVal(e.target.value)}
      onBlur={commit}
      placeholder="분야명"
      className="mb-2 w-full rounded border border-transparent bg-transparent text-sm font-semibold text-ink hover:border-line-soft focus:border-ink focus:bg-white focus:outline-none"
    />
  );
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
  const [title, setTitle] = useState(item.title);
  const [attachments, setAttachments] = useState<string[]>(item.attachments);
  const [save, setSave] = useState<SaveState>("idle");

  const persist = async (patch: Record<string, unknown>) => {
    setSave("saving");
    const r = await fillUpdateItem(token, item.id, patch);
    setSave(r.ok ? "saved" : "error");
  };

  // 이미지 붙여넣기 → 업로드 후 URL 반환(RichNote가 note HTML에 인라인 삽입).
  const uploadImage = async (dataUrl: string): Promise<string | null> => {
    setSave("saving");
    const r = await fillUploadImage(token, item.id, dataUrl);
    if (r.ok) {
      setSave("saved");
      return r.url;
    }
    setSave("error");
    return null;
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

  return (
    <div className="border border-line-soft bg-paper p-3">
      <div className="flex items-start justify-between gap-2">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={() => {
            const next = title.trim();
            if (next && next !== item.title) persist({ title: next });
            else setTitle(item.title);
          }}
          placeholder="항목명"
          className="min-w-0 flex-1 rounded border border-transparent bg-transparent text-sm text-ink hover:border-line-soft focus:border-ink focus:bg-white focus:outline-none"
        />
        <div className="flex flex-wrap items-center justify-end gap-1">
          {STATUSES.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => onStatus(s)}
              className={`${CHIP_BASE} ${status === s ? CHIP_ON : CHIP_OFF}`}
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
            className={DELETE_BTN}
          >
            삭제
          </button>
        </div>
      </div>
      <RichNote
        initialHtml={item.note}
        onSave={(html) => persist({ note: html })}
        onPasteImage={uploadImage}
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
      <div className="mt-1 flex justify-end">
        <SaveBadge state={save} />
      </div>
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
    <div className="mt-2 flex justify-end">
      <button
        type="button"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          await fillAddItem(token, department, category, "새 항목");
          setBusy(false);
          onAdded();
        }}
        className="border border-line bg-paper px-2 py-1 text-xs text-ink transition-colors hover:border-vermilion hover:bg-vermilion hover:text-cream disabled:opacity-50"
      >
        ＋ 항목 추가
      </button>
    </div>
  );
}
