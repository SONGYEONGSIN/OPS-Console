"use client";

import { useMemo, useState } from "react";
import { ModalShell } from "@/components/common/ModalShell";
import { HeaderActionButton } from "@/components/common/HeaderActionButton";
import { parseAdmissionTypes } from "@/features/dev-controls/admission-type-parse";
import { saveAdmissionTypes } from "@/features/dev-controls/admission-type-actions";

/**
 * 전형 이름표 붙여넣기.
 *
 * 원서제어 코드에는 `SelTypeCode` 와 전형 이름이 이어진 자리가 **없다**(실측:
 * 같은 줄에 있는 건 1~18 나열 한 줄뿐). 그래서 학교 명세서가 `전형 코드 5` 로만
 * 적혔다. 대학 접수 현황 자료에 그 대응이 있어 붙여넣어 채운다.
 */
export function PasteAdmissionTypes({ serviceId }: { serviceId: number }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<number | null>(null);

  // 붙여넣은 게 맞는지 눈으로 보고 저장해야 한다 — 엉뚱한 표를 넣으면 이름이 다 틀린다.
  const parsed = useMemo(() => parseAdmissionTypes(text), [text]);

  async function save() {
    setBusy(true);
    setError(null);
    const r = await saveAdmissionTypes(serviceId, parsed.rows);
    setBusy(false);
    // 실패 사유를 요약하지 않는다 — 왜 안 됐는지가 곧 조치다.
    if (!r.ok) return setError(r.error);
    setDone(r.saved);
  }

  return (
    <>
      <HeaderActionButton onClick={() => setOpen(true)}>
        + 전형 이름표
      </HeaderActionButton>

      {open ? (
        <ModalShell
          title="전형 이름표 붙여넣기"
          onClose={() => setOpen(false)}
          footer={
            <div className="flex justify-end">
              <button
                type="button"
                disabled={busy || parsed.rows.length === 0}
                onClick={save}
                className="rounded border border-line-soft px-3 py-1.5 text-sm hover:border-ink hover:bg-ink hover:text-cream disabled:opacity-40"
              >
                저장
              </button>
            </div>
          }
        >
          <div className="space-y-3 text-sm">
            <p className="text-xs text-muted">
              대학 접수 현황 자료를 그대로 붙여넣으세요. 머리글에{" "}
              <b>SelTypeCode</b> 와 <b>전형명</b> 이 있어야 합니다.
            </p>
            {/* 개인정보가 든 표를 통째로 붙여넣게 되므로 무엇을 안 읽는지 말해 준다. */}
            <p className="rounded bg-situation-bg px-3 py-2 text-xs text-muted">
              수험번호·아이디 같은 개인정보 칸은 <b>읽지 않습니다</b> — 전형
              코드와 이름만 가져옵니다.
            </p>

            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={6}
              className="w-full rounded border border-line-soft bg-field-bg px-3 py-2 font-mono text-xs focus:border-ink focus:bg-white"
            />

            {error ? (
              <p className="rounded bg-situation-bg px-3 py-2 text-vermilion">
                {error}
              </p>
            ) : null}
            {parsed.headerError ? (
              <p className="text-xs text-vermilion">{parsed.headerError}</p>
            ) : null}
            {done !== null ? (
              <p className="text-xs text-ink">
                전형 {done}개를 저장했습니다. 명세서를 다시 만들면 이름이
                반영됩니다.
              </p>
            ) : null}

            {parsed.rows.length > 0 ? (
              <div>
                <p className="mb-1 text-xs text-muted">
                  전형 {parsed.rows.length}개
                  {parsed.skipped ? ` · 코드가 없어 버린 행 ${parsed.skipped}` : ""}
                </p>
                <ul className="max-h-56 overflow-y-auto rounded border border-line-soft">
                  {parsed.rows.map((r) => (
                    <li
                      key={r.selTypeCode}
                      className="flex gap-3 border-b border-line-soft px-3 py-1.5 text-xs last:border-b-0"
                    >
                      <span className="w-8 shrink-0 text-right tabular-nums text-muted">
                        {r.selTypeCode}
                      </span>
                      <span className="w-8 shrink-0 font-mono text-muted">
                        {r.univCode}
                      </span>
                      <span className="text-ink">{r.name}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        </ModalShell>
      ) : null}
    </>
  );
}
