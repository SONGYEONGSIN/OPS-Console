"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ListSearch } from "@/components/common/ListSearch";
import { KpiCard, type KpiCardItem } from "@/components/common/KpiCard";
import { setToolEnabled } from "@/features/dev-tools/actions";
import type { ToolBoard } from "@/features/dev-tools/queries";
import type { ToolRow } from "@/features/dev-tools/merge";
import type { ToolKind } from "@/features/dev-tools/scan";

const KIND_LABEL: Record<ToolKind, string> = {
  skill: "스킬",
  agent: "에이전트",
  hook: "훅",
  rule: "룰",
};

/** 비교 대상(직전 기간)이 없는 화면이라 delta 는 전부 null 이다. */
const kpi = (label: string, value: number, unit: string): KpiCardItem => ({
  label,
  value,
  unit,
  delta: null,
  deltaPct: null,
  prevValue: null,
  goodOnIncrease: true,
});

function fmtWhen(iso: string): string {
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

export function ToolsClient({
  board,
  kind,
}: {
  board: ToolBoard;
  kind: ToolKind;
}) {
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState<string | null>(null);

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return board.rows
      .filter((r) => r.kind === kind)
      .filter(
        (r) =>
          !needle ||
          `${r.name} ${r.description}`.toLowerCase().includes(needle),
      );
  }, [board.rows, kind, q]);

  const current = rows.find((r) => r.name === selected) ?? rows[0] ?? null;

  const cards: KpiCardItem[] = [
    kpi("스킬", board.counts.skill, "개"),
    kpi("에이전트", board.counts.agent, "개"),
    kpi("훅", board.counts.hook, "개"),
    kpi("룰", board.counts.rule, "개"),
  ];

  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {cards.map((item) => (
          <KpiCard key={item.label} item={item} />
        ))}
      </div>

      <ApplyBanner board={board} />

      <section>
        <header className="mb-3 flex items-baseline gap-2">
          <h3 className="text-xl font-bold text-ink">{KIND_LABEL[kind]}</h3>
          <span className="text-muted" aria-hidden>
            ·
          </span>
          <span className="text-sm text-vermilion">{rows.length}개</span>
        </header>

        <div className="mb-3">
          <ListSearch value={q} onChange={setQ} placeholder="이름 · 설명 검색" />
        </div>

        {rows.length === 0 ? (
          <p className="border border-line-soft bg-situation-bg px-4 py-8 text-center text-sm text-muted">
            찾는 도구가 없습니다.
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,18rem)_minmax(0,1fr)]">
            <ul className="max-h-[32rem] overflow-y-auto border border-line-soft">
              {rows.map((r) => (
                <li key={r.name}>
                  <button
                    type="button"
                    onClick={() => setSelected(r.name)}
                    className={`flex w-full items-center justify-between gap-2 border-b border-line-soft px-3 py-2 text-left text-sm transition-colors ${
                      current?.name === r.name
                        ? "border-vermilion bg-vermilion/10 text-vermilion"
                        : "text-ink hover:bg-line-soft"
                    }`}
                  >
                    <span className="truncate">{r.name}</span>
                    {!r.enabled && (
                      <span className="shrink-0 bg-line-soft px-1.5 py-0.5 text-2xs text-muted">
                        꺼짐
                      </span>
                    )}
                  </button>
                </li>
              ))}
            </ul>

            {current && <Detail row={current} />}
          </div>
        )}
      </section>
    </div>
  );
}

/**
 * 웹에서 끈 것이 아직 로컬에 반영되지 않았음을 드러낸다.
 *
 * 이게 없으면 껐다고 믿은 채로 계속 돌게 된다 — 화면과 실제가 조용히 갈라지는 게
 * 이 구조의 유일한 위험이다.
 */
function ApplyBanner({ board }: { board: ToolBoard }) {
  if (board.unapplied === 0 && board.applies.length === 0) return null;
  return (
    <div className="border border-line-soft bg-situation-bg px-4 py-3 text-xs">
      {board.unapplied > 0 ? (
        <p className="text-vermilion-deep">
          아직 반영 안 된 변경 {board.unapplied}건 — 해당 PC에서{" "}
          <code className="font-mono">npm run tools:apply</code> 를 실행해야
          실제로 켜지고 꺼집니다.
        </p>
      ) : (
        <p className="text-muted">변경이 모두 반영되어 있습니다.</p>
      )}
      {board.applies.length > 0 && (
        <p className="mt-1 text-muted">
          마지막 반영 —{" "}
          {board.applies
            .map((a) => `${a.machine} ${fmtWhen(a.appliedAt)}`)
            .join(" · ")}
        </p>
      )}
    </div>
  );
}

function Detail({ row }: { row: ToolRow }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  return (
    <div className="border border-line-soft p-5">
      <header className="mb-4 flex items-start justify-between gap-3">
        <h4 className="font-mono text-lg font-bold text-ink">{row.name}</h4>
        <span className="shrink-0 bg-line-soft px-2 py-0.5 text-xs text-muted">
          {KIND_LABEL[row.kind]}
        </span>
      </header>

      <dl className="space-y-3 text-sm">
        {row.invoke && (
          <Field label="호출 명령어">
            <code className="bg-field-bg px-2 py-0.5 font-mono text-xs text-ink">
              {row.invoke}
            </code>
          </Field>
        )}

        <Field label="활성화">
          {row.toggleable ? (
            <span className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                disabled={pending}
                onClick={() => {
                  setError(null);
                  startTransition(async () => {
                    const r = await setToolEnabled(
                      row.kind,
                      row.name,
                      !row.enabled,
                    );
                    if (r.ok) router.refresh();
                    else setError(r.error);
                  });
                }}
                className="cursor-pointer border border-line-soft px-2.5 py-1 text-xs text-ink transition-colors hover:bg-ink hover:text-cream disabled:cursor-not-allowed disabled:opacity-40"
              >
                {pending ? "바꾸는 중" : row.enabled ? "끄기" : "켜기"}
              </button>
              <span className={row.enabled ? "text-ink" : "text-muted"}>
                {row.enabled ? "활성" : "꺼짐"}
              </span>
              {error && <span className="text-2xs text-vermilion">{error}</span>}
            </span>
          ) : (
            // 끌 수 없는 종류에 스위치를 놓지 않는다. 눌러도 안 되는 버튼은
            // 없는 것만 못하다.
            <span className="text-muted">
              활성 — 파일이 있으면 곧 활성입니다 (끄려면 파일을 옮겨야 합니다)
            </span>
          )}
        </Field>

        {Object.entries(row.meta).map(([k, v]) => (
          <Field key={k} label={k}>
            <span className="text-ink-soft">{v}</span>
          </Field>
        ))}

        <Field label="경로">
          <code className="font-mono text-xs text-ink-soft">{row.path}</code>
        </Field>

        {row.description && (
          <Field label="설명">
            <p className="whitespace-pre-line text-ink-soft">
              {row.description}
            </p>
          </Field>
        )}
      </dl>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid grid-cols-[6rem_minmax(0,1fr)] gap-3">
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="min-w-0">{children}</dd>
    </div>
  );
}
