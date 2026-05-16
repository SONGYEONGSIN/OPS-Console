"use client";

import { useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  HANDOVER_CATEGORIES,
  HANDOVER_FIELD_KEYS,
  type HandoverCategoryKey,
  type HandoverFieldKey,
} from "@/features/handover/categories";
import { upsertHandoverRecord } from "@/features/handover/actions";

type Props = {
  serviceId: string;
  initial: Record<HandoverFieldKey, string | null>;
};

export function HandoverForm({ serviceId, initial }: Props) {
  const router = useRouter();
  const params = useSearchParams();
  const active = (params.get("cat") ?? "contract") as HandoverCategoryKey;
  const [values, setValues] = useState<Record<HandoverFieldKey, string>>(() => {
    const v = {} as Record<HandoverFieldKey, string>;
    for (const k of HANDOVER_FIELD_KEYS) v[k] = initial[k] ?? "";
    return v;
  });
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const dirty = HANDOVER_FIELD_KEYS.some(
    (k) => values[k] !== (initial[k] ?? ""),
  );
  const cat = HANDOVER_CATEGORIES.find((c) => c.key === active);
  if (!cat) return null;

  function setField(k: HandoverFieldKey, v: string) {
    setValues((prev) => ({ ...prev, [k]: v }));
  }

  function handleSave() {
    setError(null);
    const payload: Record<string, unknown> = { service_id: serviceId };
    for (const k of HANDOVER_FIELD_KEYS) {
      payload[k] = values[k].trim() === "" ? null : values[k];
    }
    startTransition(async () => {
      const r = await upsertHandoverRecord(payload);
      if (!r.ok) setError(r.error);
      else router.refresh();
    });
  }

  return (
    <div className="px-14 py-12">
      <h2 className="mb-10 text-3xl font-bold text-ink">{cat.label} 설정</h2>
      {cat.fields.map((f) => (
        <label
          key={f.key}
          className="mb-9 grid grid-cols-[140px_1fr] items-start gap-6"
        >
          <span className="pt-3 text-sm text-ink-soft">{f.label}</span>
          <textarea
            aria-label={f.label}
            value={values[f.key]}
            onChange={(e) => setField(f.key, e.target.value)}
            rows={4}
            maxLength={10000}
            className="w-full border border-line bg-transparent px-4 py-3 text-sm text-ink outline-none focus:border-ink"
          />
        </label>
      ))}
      {error && <p className="mb-3 text-sm text-vermilion">{error}</p>}
      <div className="flex gap-3 pt-6">
        <button
          type="button"
          onClick={handleSave}
          disabled={!dirty || isPending}
          className="bg-ink-soft px-12 py-3 text-sm font-medium text-cream disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isPending ? "저장 중..." : "저장"}
        </button>
        <button
          type="button"
          onClick={() => router.push("/dashboard/handover")}
          className="border border-line bg-transparent px-12 py-3 text-sm text-ink hover:bg-washi-raised"
        >
          취소
        </button>
      </div>
    </div>
  );
}
