"use client";

import { useState } from "react";
import type { ListRow } from "../patterns/ListPattern";

type Props = {
  row: ListRow;
  editing: boolean;
  onSave: (next: ListRow) => void;
  onCancel: () => void;
};

/**
 * InspectorListBody — list pattern row 인스펙터 본문.
 * mockup folio-dashboard.html 의 인스펙터 패널 구조 매칭:
 *   1) 헤더 (overline · title · meta · 상태 동그라미)
 *   2) 속성 section
 *   3) 실시간 지표 section
 *   4) 담당 · 온콜 section
 * 데모 데이터는 row 정보 기반 + 고정 mock 혼합.
 */
export function InspectorListBody({ row, editing, onSave, onCancel }: Props) {
  const [draft, setDraft] = useState<ListRow>(row);

  if (!editing) {
    return <ViewMode row={row} />;
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSave(draft);
      }}
      className="space-y-3"
    >
      <label className="block text-xs">
        <span className="mb-1 block text-muted">이름</span>
        <input
          aria-label="이름"
          value={draft.name}
          onChange={(e) => setDraft({ ...draft, name: e.target.value })}
          className="w-full border border-line bg-cream px-2 py-1 text-ink"
        />
      </label>
      <label className="block text-xs">
        <span className="mb-1 block text-muted">담당</span>
        <input
          aria-label="담당"
          value={draft.owner}
          onChange={(e) => setDraft({ ...draft, owner: e.target.value })}
          className="w-full border border-line bg-cream px-2 py-1 text-ink"
        />
      </label>
      <div className="flex gap-2 pt-2">
        <button
          type="submit"
          className="flex-1 border border-line bg-vermilion px-3 py-1.5 text-sm font-medium text-cream hover:bg-vermilion-deep"
        >
          저장
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 border border-line bg-transparent px-3 py-1.5 text-sm text-ink hover:bg-washi"
        >
          취소
        </button>
      </div>
    </form>
  );
}

/* ════════════════════════════════════════════════════════════
   ViewMode — mockup 3섹션 풍부 구조
   ════════════════════════════════════════════════════════════ */
function ViewMode({ row }: { row: ListRow }) {
  const statusLabel = STATUS_LABEL[row.status];
  const statusColor = STATUS_BADGE[row.status];

  return (
    <div className="space-y-6">
      {/* Section 1 — 속성 */}
      <Section title="속성">
        <DefList
          items={[
            { term: "항목 ID", desc: <span className="font-mono">{row.id}</span> },
            { term: "네임스페이스", desc: "ops / 운영" },
            { term: "담당", desc: row.owner },
            { term: "포트", desc: ":8080 HTTP · :9000 gRPC" },
            { term: "리전", desc: "ap-northeast-2 · 3 AZ" },
            { term: "런타임", desc: "Node 22 · Next.js 16" },
            {
              term: "상태",
              desc: (
                <span className={`inline-block px-2 py-0.5 text-xs ${statusColor}`}>
                  {statusLabel}
                </span>
              ),
            },
          ]}
        />
      </Section>

      <Divider />

      {/* Section 2 — 실시간 지표 */}
      <Section title="실시간 지표">
        <DefList
          items={[
            {
              term: "처리량",
              desc: (
                <span>
                  12,480 req/s <span className="text-sage">▲ 8.2%</span> 전일 대비
                </span>
              ),
            },
            {
              term: "p99 응답",
              desc: (
                <strong className="font-bold text-vermilion">
                  184 ms · 임계 150ms 초과
                </strong>
              ),
            },
            {
              term: "오류율",
              desc: (
                <strong className="font-bold text-vermilion">
                  0.42% · 경고 단계
                </strong>
              ),
            },
            { term: "CPU", desc: "62% · 12 인스턴스 평균" },
            {
              term: "메모리",
              desc: <span className="text-gold">78% · 임계 85% 근접</span>,
            },
          ]}
        />
      </Section>

      <Divider />

      {/* Section 3 — 담당 · 온콜 */}
      <Section title="담당 · 온콜">
        <DefList
          items={[
            { term: "담당 팀", desc: `${row.owner} · L3 엔지니어링` },
            { term: "1차 온콜", desc: "박현주 · 다음 교대까지 7시간" },
            { term: "2차 온콜", desc: "김지현" },
            { term: "에스컬레이션", desc: "플랫폼 엔지니어링 (자동 · T+30m)" },
          ]}
        />
      </Section>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════
   helpers
   ════════════════════════════════════════════════════════════ */
const STATUS_LABEL: Record<ListRow["status"], string> = {
  urgent: "장애",
  active: "활성",
  review: "점검중",
  approved: "정상",
};

const STATUS_BADGE: Record<ListRow["status"], string> = {
  urgent: "bg-vermilion text-cream",
  active: "bg-sage/20 text-sage",
  review: "bg-gold/20 text-gold",
  approved: "bg-line-soft text-muted",
};

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3">
      <h4 className="text-xs font-medium uppercase tracking-[0.12em] text-muted">
        {title}
      </h4>
      {children}
    </section>
  );
}

function DefList({
  items,
}: {
  items: { term: string; desc: React.ReactNode }[];
}) {
  return (
    <dl className="grid grid-cols-[88px_1fr] gap-x-3 gap-y-2 text-sm">
      {items.map((item, i) => (
        <div key={i} className="contents">
          <dt className="text-xs text-muted">{item.term}</dt>
          <dd className="text-ink">{item.desc}</dd>
        </div>
      ))}
    </dl>
  );
}

function Divider() {
  return <div className="border-t border-line-soft" />;
}
