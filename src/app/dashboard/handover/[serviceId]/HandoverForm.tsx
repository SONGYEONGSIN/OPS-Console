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
    <div className="flex flex-col gap-4 overflow-y-auto">
      <h3 className="text-xl font-semibold tracking-[-0.02em]">
        {cat.label} 설정
      </h3>
      {cat.fields.map((f) => (
        <label
          key={f.key}
          className="grid grid-cols-1 items-start gap-2 md:grid-cols-[160px_1fr]"
        >
          <span className="pt-2 text-sm text-muted">{f.label}</span>
          <textarea
            aria-label={f.label}
            value={values[f.key]}
            onChange={(e) => setField(f.key, e.target.value)}
            rows={4}
            maxLength={10000}
            className="w-full border border-line bg-transparent px-3 py-2 text-sm text-ink outline-none focus:border-vermilion"
          />
        </label>
      ))}
      {error && <p className="text-sm text-vermilion">{error}</p>}
      <div className="mt-4 flex gap-2">
        <button
          type="button"
          onClick={handleSave}
          disabled={!dirty || isPending}
          className="cursor-pointer border border-ink bg-ink px-5 py-2 text-sm tracking-[0.04em] text-cream disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isPending ? "저장 중..." : "저장"}
        </button>
        <button
          type="button"
          onClick={() => router.push("/dashboard/handover")}
          className="cursor-pointer border border-line bg-transparent px-5 py-2 text-sm tracking-[0.04em] text-ink hover:border-vermilion hover:text-vermilion"
        >
          취소
        </button>
      </div>
    </div>
  );
}
