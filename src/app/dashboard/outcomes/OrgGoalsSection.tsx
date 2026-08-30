"use client";

import { useState } from "react";
import { ModalShell } from "@/components/common/ModalShell";
import { HeaderActionButton } from "@/components/common/HeaderActionButton";
import { DateInput } from "@/components/common/DateInput";
import {
  upsertOrgGoal,
  deleteOrgGoal,
} from "@/features/performance/org-goal-actions";
import { AGGREGATOR_REGISTRY } from "@/features/performance/aggregators/registry";

type Goal = {
  id: string;
  scope: "division" | "team";
  owner_name: string;
  period_start: string;
  period_end: string;
  title: string;
  target_value: number | null;
  unit: string | null;
  source_key: string | null;
  lower_is_better: boolean;
  note: string | null;
  actual: number | null;
  memberCount: number;
  achievement: number | null;
};

const SOURCE_KEYS = Object.keys(AGGREGATOR_REGISTRY) as (keyof typeof AGGREGATOR_REGISTRY)[];

const EMPTY = {
  scope: "team" as "division" | "team",
  owner_name: "운영1팀",
  period_start: "2026-03-01",
  period_end: "2027-02-28",
  title: "",
  target_value: "",
  unit: "건",
  source_key: "",
  lower_is_better: false,
  note: "",
};

/**
 * 조직 목표(본부·팀) 등록·조회.
 *
 * 개인 목표는 assignment 에 매달려 있어 "팀 전체가 무엇을 목표로 하는가"를
 * 담을 수 없다. 그래서 표가 따로 있고, 이 화면이 그 표의 유일한 입구다.
 *
 * **목표 옆에 실적과 달성률을 같이 둔다** — 목표만 적어 두면 아무도 안 본다.
 */
export function OrgGoalsSection({ goals }: { goals: Goal[] }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<typeof EMPTY & { id?: string }>(EMPTY);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function openNew() {
    setForm(EMPTY);
    setError(null);
    setOpen(true);
  }

  function openEdit(g: Goal) {
    setForm({
      id: g.id,
      scope: g.scope,
      owner_name: g.owner_name,
      period_start: g.period_start,
      period_end: g.period_end,
      title: g.title,
      target_value: g.target_value === null ? "" : String(g.target_value),
      unit: g.unit ?? "",
      source_key: g.source_key ?? "",
      lower_is_better: g.lower_is_better,
      note: g.note ?? "",
    });
    setError(null);
    setOpen(true);
  }

  async function save() {
    setBusy(true);
    setError(null);
    const r = await upsertOrgGoal({
      id: form.id,
      scope: form.scope,
      owner_name: form.owner_name,
      period_start: form.period_start,
      period_end: form.period_end,
      title: form.title,
      target_value: form.target_value === "" ? null : Number(form.target_value),
      unit: form.unit === "" ? null : form.unit,
      source_key: form.source_key === "" ? null : form.source_key,
      lower_is_better: form.lower_is_better,
      note: form.note === "" ? null : form.note,
    });
    setBusy(false);
    // 실패 사유를 요약하지 않는다 — 왜 안 됐는지가 곧 조치다.
    if (!r.ok) return setError(r.error);
    setOpen(false);
  }

  async function remove(id: string) {
    setBusy(true);
    const r = await deleteOrgGoal(id);
    setBusy(false);
    if (!r.ok) setError(r.error ?? "삭제하지 못했습니다");
  }

  return (
    <section className="px-7 pt-4">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-xl font-bold text-ink">
          조직 목표{" "}
          <span className="text-muted">· {goals.length}건</span>
        </h2>
        <HeaderActionButton onClick={openNew}>+ 조직 목표</HeaderActionButton>
      </div>

      {goals.length === 0 ? (
        <p className="rounded-md bg-situation-bg px-4 py-8 text-center text-sm text-muted">
          등록된 조직 목표가 없습니다. 본부·팀 목표를 등록하면 소속원 실적을
          합산해 달성률이 나옵니다.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead>
              <tr className="border-b border-line font-bold text-left text-xs uppercase tracking-[0.06em] text-muted">
                <th className="px-3 py-2">조직</th>
                <th className="px-3 py-2">목표</th>
                <th className="px-3 py-2">기간</th>
                <th className="px-3 py-2 text-right">목표값</th>
                <th className="px-3 py-2 text-right">실적</th>
                <th className="px-3 py-2 text-right">달성률</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {goals.map((g) => (
                <tr
                  key={g.id}
                  className="border-b border-line-soft hover:bg-line-soft"
                >
                  <td className="px-3 py-2">
                    <div className="text-ink">{g.owner_name}</div>
                    {/* 조직 이름이 조직도와 안 맞으면 합산 대상이 0 명이라
                        실적이 영영 0 이다. 조용히 두면 목표가 안 채워지는
                        이유를 아무도 모른다. */}
                    {g.memberCount === 0 ? (
                      <div className="text-xs text-vermilion">
                        소속원이 없습니다 — 조직명 확인
                      </div>
                    ) : (
                      <div className="text-xs text-muted tabular-nums">
                        {g.memberCount}명
                      </div>
                    )}
                  </td>
                  <td className="px-3 py-2 text-ink">{g.title}</td>
                  <td className="px-3 py-2 text-muted tabular-nums">
                    {g.period_start} ~ {g.period_end}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {g.target_value === null
                      ? "—"
                      : `${g.target_value}${g.unit ?? ""}`}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {g.actual === null ? "—" : `${g.actual}${g.unit ?? ""}`}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {g.achievement === null ? "—" : `${g.achievement}%`}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <button
                      type="button"
                      onClick={() => openEdit(g)}
                      className="rounded border border-line-soft px-2 py-1 text-xs hover:border-ink hover:bg-ink hover:text-cream"
                    >
                      수정
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {open ? (
        <ModalShell
          title={form.id ? "조직 목표 수정" : "조직 목표 등록"}
          onClose={() => setOpen(false)}
          footer={
            <div className="flex items-center justify-between gap-2">
              {form.id ? (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => remove(form.id as string)}
                  className="rounded border border-line-soft px-3 py-1.5 text-sm hover:border-ink hover:bg-ink hover:text-cream"
                >
                  삭제
                </button>
              ) : (
                <span />
              )}
              <button
                type="button"
                disabled={busy}
                onClick={save}
                className="rounded border border-line-soft px-3 py-1.5 text-sm hover:border-ink hover:bg-ink hover:text-cream"
              >
                저장
              </button>
            </div>
          }
        >
          <div className="space-y-3 text-sm">
            {error ? (
              <p className="rounded bg-situation-bg px-3 py-2 text-vermilion">
                {error}
              </p>
            ) : null}
            <label className="block">
              <span className="mb-1 block text-xs text-muted">구분</span>
              <select
                value={form.scope}
                onChange={(e) =>
                  setForm({
                    ...form,
                    scope: e.target.value as "division" | "team",
                  })
                }
                className="w-full rounded border border-line-soft bg-field-bg px-3 py-2 focus:border-ink focus:bg-white"
              >
                <option value="team">팀</option>
                <option value="division">본부(부서)</option>
              </select>
            </label>
            <label className="block">
              <span className="mb-1 block text-xs text-muted">
                조직명 {form.scope === "team" ? "(예: 운영1팀)" : "(예: 운영부)"}
              </span>
              <input
                value={form.owner_name}
                onChange={(e) =>
                  setForm({ ...form, owner_name: e.target.value })
                }
                className="w-full rounded border border-line-soft bg-field-bg px-3 py-2 focus:border-ink focus:bg-white"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs text-muted">목표 제목</span>
              <input
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                className="w-full rounded border border-line-soft bg-field-bg px-3 py-2 focus:border-ink focus:bg-white"
              />
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className="mb-1 block text-xs text-muted">시작</span>
                <DateInput
                  value={form.period_start}
                  onChange={(e) =>
                    setForm({ ...form, period_start: e.target.value })
                  }
                  className="w-full rounded border border-line-soft bg-field-bg px-3 py-2 focus:border-ink focus:bg-white"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs text-muted">종료</span>
                <DateInput
                  value={form.period_end}
                  onChange={(e) =>
                    setForm({ ...form, period_end: e.target.value })
                  }
                  className="w-full rounded border border-line-soft bg-field-bg px-3 py-2 focus:border-ink focus:bg-white"
                />
              </label>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className="mb-1 block text-xs text-muted">목표값</span>
                <input
                  value={form.target_value}
                  onChange={(e) =>
                    setForm({ ...form, target_value: e.target.value })
                  }
                  inputMode="numeric"
                  className="w-full rounded border border-line-soft bg-field-bg px-3 py-2 tabular-nums focus:border-ink focus:bg-white"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs text-muted">단위</span>
                <input
                  value={form.unit}
                  onChange={(e) => setForm({ ...form, unit: e.target.value })}
                  className="w-full rounded border border-line-soft bg-field-bg px-3 py-2 focus:border-ink focus:bg-white"
                />
              </label>
            </div>
            <label className="block">
              <span className="mb-1 block text-xs text-muted">
                집계 소스 — 고르면 소속원 실적을 합산해 달성률이 저절로 나온다
              </span>
              <select
                value={form.source_key}
                onChange={(e) =>
                  setForm({ ...form, source_key: e.target.value })
                }
                className="w-full rounded border border-line-soft bg-field-bg px-3 py-2 focus:border-ink focus:bg-white"
              >
                <option value="">없음 — 사람이 눈으로 본다</option>
                {SOURCE_KEYS.map((k) => (
                  <option key={k} value={k}>
                    {AGGREGATOR_REGISTRY[k].label} ({AGGREGATOR_REGISTRY[k].unit}
                    )
                  </option>
                ))}
              </select>
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={form.lower_is_better}
                onChange={(e) =>
                  setForm({ ...form, lower_is_better: e.target.checked })
                }
              />
              <span className="text-xs text-muted">
                적을수록 좋은 목표 (사고 건수 등)
              </span>
            </label>
            <label className="block">
              <span className="mb-1 block text-xs text-muted">메모</span>
              <textarea
                value={form.note}
                onChange={(e) => setForm({ ...form, note: e.target.value })}
                rows={2}
                className="w-full rounded border border-line-soft bg-field-bg px-3 py-2 focus:border-ink focus:bg-white"
              />
            </label>
          </div>
        </ModalShell>
      ) : null}
    </section>
  );
}
