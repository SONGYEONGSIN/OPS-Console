"use client";

import { useState } from "react";
import type { EditFormProps } from "../types";

export function CopySection({
  fromServiceId,
  candidates,
  onCopy,
}: {
  fromServiceId: string;
  candidates: NonNullable<EditFormProps["handoverServiceCandidates"]>;
  onCopy: NonNullable<EditFormProps["onCopyHandover"]>;
}) {
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [pending, setPending] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const term = q.trim();
  const results = term
    ? candidates
        .filter((c) => c.id !== fromServiceId)
        .filter(
          (c) =>
            c.universityName.includes(term) ||
            c.serviceName.includes(term) ||
            String(c.serviceId).includes(term),
        )
        .slice(0, 12)
    : [];

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function run() {
    const ids = [...selected];
    if (ids.length === 0) return;
    const overwriting = candidates.filter(
      (c) => ids.includes(c.id) && c.hasRecord,
    );
    if (overwriting.length > 0) {
      const names = overwriting
        .map((c) => `${c.universityName} · ${c.serviceName}`)
        .join("\n");
      if (
        !window.confirm(
          `다음 ${overwriting.length}개 서비스는 이미 작성된 내용이 있습니다. 덮어쓰시겠습니까?\n\n${names}`,
        )
      )
        return;
    }
    setPending(true);
    setMsg(null);
    const r = await onCopy(fromServiceId, ids);
    setPending(false);
    if (r.ok) {
      setMsg(`${r.copiedCount ?? ids.length}개 서비스로 복제 완료`);
      setSelected(new Set());
      setQ("");
    } else {
      setMsg(r.error ?? "복제 실패");
    }
  }

  return (
    <section className="space-y-2">
      <p className="text-2xs uppercase tracking-[0.18em] text-muted">
        다른 서비스로 복제
      </p>
      <p className="text-2xs text-muted">
        현재 서비스 내용을 다른 서비스(2, 3차)로 복제 가능합니다.
      </p>
      <input
        aria-label="복제 대상 서비스 검색"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="대학명 · 서비스명 · service_id 검색"
        className="w-full border border-line bg-cream px-2 py-1 text-xs text-ink transition-colors focus:border-ink focus:bg-white"
      />
      {term && results.length === 0 ? (
        <p className="text-2xs text-muted">검색 결과 없음</p>
      ) : null}
      {results.length > 0 ? (
        <ul className="max-h-48 space-y-0.5 overflow-y-auto border border-line-soft p-1">
          {results.map((c) => (
            <li key={c.id}>
              <label className="flex cursor-pointer items-center gap-2 px-1 py-1 text-xs hover:bg-washi-raised">
                <input
                  type="checkbox"
                  checked={selected.has(c.id)}
                  onChange={() => toggle(c.id)}
                  className="h-3.5 w-3.5 accent-vermilion"
                />
                <span className="truncate text-ink">
                  {c.universityName} · {c.serviceName}
                </span>
                {c.hasRecord ? (
                  <span className="ml-auto shrink-0 bg-vermilion/20 px-1 py-0.5 text-2xs text-vermilion-deep">
                    작성됨
                  </span>
                ) : null}
              </label>
            </li>
          ))}
        </ul>
      ) : null}
      {selected.size > 0 ? (
        <button
          type="button"
          onClick={run}
          disabled={pending}
          className="w-full border border-line bg-vermilion px-3 py-1.5 text-sm font-medium text-cream hover:bg-vermilion-deep disabled:opacity-50"
        >
          {pending ? "복제 중…" : `${selected.size}개 서비스로 복제`}
        </button>
      ) : null}
      {msg ? <p className="text-2xs text-ink-soft">{msg}</p> : null}
    </section>
  );
}
