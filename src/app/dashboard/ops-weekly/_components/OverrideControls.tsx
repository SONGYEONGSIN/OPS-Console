"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import type { AutoArea } from "@/features/ops-weekly/constants";
import { saveItemOverride } from "@/features/ops-weekly/actions";
import { ERROR_CLASS, FIELD_CLASS, ROW_BTN_CLASS } from "./styles";
import { useSave } from "./use-save";

type Props = {
  reportId: string | null;
  itemKey: string;
  area: AutoArea;
  note: string;
  excluded: boolean;
  editable: boolean;
  /** 행 1줄의 정보(제목·부제·시각 등) — 액션 묶음이 이 줄 오른쪽 끝에 붙는다. */
  children?: ReactNode;
};

// lg 이상에서는 호버·포커스 때만 드러난다(Tab 으로 닿으면 focus-within 이 연다). 그 아래는 늘 보인다.
const REVEAL =
  "lg:opacity-0 lg:group-hover:opacity-100 lg:group-focus-within:opacity-100";

/**
 * 행 1줄(정보 + 액션) 아래에 건별 메모를 글로 보여 준다. 메모는 [메모]를 눌러야 입력칸이 된다.
 * 자동 목록 묶음과 휴가 탭이 같이 쓴다 — 부르는 쪽 `li` 에 `group` 이 있어야 액션이 드러난다.
 */
export function OverrideControls(props: Props) {
  const { reportId, itemKey, area, note, excluded, editable, children } = props;
  const [shown, setShown] = useState(note);
  const [draft, setDraft] = useState(note);
  const [editing, setEditing] = useState(false);
  // Enter·Esc 로 닫힌 뒤 따라오는 blur 가 다시 저장하지 않게 한다.
  const closed = useRef(true);
  const input = useRef<HTMLInputElement>(null);
  const { pending, error, run } = useSave({ track: true });

  useEffect(() => {
    if (editing) input.current?.focus();
  }, [editing]);

  const line =
    children === undefined ? null : (
      <div
        className={`flex flex-wrap items-baseline gap-x-2 gap-y-1 text-sm ${
          excluded ? "text-muted line-through" : "text-ink"
        }`}
      >
        {children}
        {editable && reportId !== null ? actions() : null}
      </div>
    );

  function actions() {
    if (reportId === null) return null;
    return (
      <div
        className={`ml-auto flex items-center gap-1 transition-opacity ${
          excluded ? "" : REVEAL
        }`}
      >
        <button type="button" className={ROW_BTN_CLASS} onClick={startEdit}>
          {shown ? "메모 고치기" : "메모"}
        </button>
        <button
          type="button"
          disabled={pending}
          className={ROW_BTN_CLASS}
          onClick={() =>
            run(() =>
              saveItemOverride({
                reportId,
                itemKey,
                area,
                excluded: !excluded,
              }),
            )
          }
        >
          {excluded ? "되살리기" : "빼기"}
        </button>
      </div>
    );
  }

  function startEdit() {
    closed.current = false;
    setDraft(shown);
    setEditing(true);
  }

  function cancel() {
    closed.current = true;
    setDraft(shown);
    setEditing(false);
  }

  function commit() {
    if (closed.current || reportId === null) return;
    closed.current = true;
    setEditing(false);
    if (draft === shown) return;
    setShown(draft);
    run(() => saveItemOverride({ reportId, itemKey, area, note: draft }));
  }

  if (!editable || reportId === null) {
    return (
      <>
        {line}
        {note ? <p className="break-words text-xs text-muted">{note}</p> : null}
      </>
    );
  }
  return (
    <>
      {line}
      {editing ? (
        <input
          ref={input}
          type="text"
          aria-label="건 메모"
          placeholder="특이사항"
          value={draft}
          maxLength={1000}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") commit();
            else if (e.key === "Escape") cancel();
          }}
          className={`${FIELD_CLASS} w-full`}
        />
      ) : shown || pending ? (
        <p className="break-words text-xs text-ink-soft">
          {shown}
          {pending ? <span className="ml-2 text-muted">저장 중…</span> : null}
        </p>
      ) : null}
      {error ? (
        <p role="alert" className={ERROR_CLASS}>
          {error}
        </p>
      ) : null}
    </>
  );
}
