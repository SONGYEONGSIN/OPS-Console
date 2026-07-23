"use client";
import { useState } from "react";
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
} from "@/features/checklist/fill-actions";
import { STATUS_LABEL } from "./status-ui";

type SaveState = "idle" | "saving" | "saved" | "error";

// 상태 칩 표준: 기본 흰 배경 + 호버 빨강, 선택 시 버밀리언 틴트. 삭제는 기본 빨강 버튼.
const CHIP_BASE = "border px-2 py-1 text-xs transition-colors";
const CHIP_ON = "border-vermilion bg-vermilion/10 text-vermilion";
const CHIP_OFF =
  "border-line bg-paper text-ink hover:border-vermilion hover:text-vermilion";
const DELETE_BTN =
  "border border-vermilion bg-vermilion px-2 py-1 text-xs text-cream transition-colors hover:opacity-90";

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
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.06em] text-muted">
              어플라이본부 원서접수 점검 진행 상황
            </p>
            <h1 className="mt-2 text-2xl font-bold text-ink">{roundTitle}</h1>
            <p className="mt-1 text-sm text-muted">
              {periodStart ?? "-"} ~ {periodEnd ?? "-"}
            </p>
          </div>
          {depts.length > 1 ? (
            <div className="flex flex-wrap justify-end gap-1">
              <button
                type="button"
                onClick={() => setActiveDept(null)}
                className={`${CHIP_BASE} ${activeDept === null ? CHIP_ON : CHIP_OFF}`}
              >
                전체
              </button>
              {depts.map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setActiveDept(d)}
                  className={`${CHIP_BASE} ${activeDept === d ? CHIP_ON : CHIP_OFF}`}
                >
                  {deptLabel(d)}
                </button>
              ))}
            </div>
          ) : null}
        </div>
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

      {shown.map((dept) => {
        const deptItems = items.filter((i) => i.department === dept);
        const cats = Array.from(new Set(deptItems.map((i) => i.category)));
        return (
          <section key={dept} className="mt-8">
            <h2 className="border-b-2 border-ink pb-1.5 text-base font-bold text-ink">
              {deptLabel(dept)}
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
        <span className="text-sm text-ink">{item.title}</span>
        <SaveBadge state={save} />
      </div>
      <div className="mt-2 flex flex-wrap items-center justify-end gap-1">
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
