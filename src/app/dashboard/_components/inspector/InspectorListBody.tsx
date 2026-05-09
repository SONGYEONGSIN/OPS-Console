"use client";

import { useState } from "react";
import type { ListRow } from "../patterns/ListPattern";
import {
  OPERATORS,
  ageOf,
  tenureLabel,
  tenureYears,
} from "@/features/auth/operators";

type Props = {
  row: ListRow;
  editing: boolean;
  onSave: (next: ListRow) => void;
  onCancel: () => void;
  variant?: "default" | "team";
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
export function InspectorListBody({
  row,
  editing,
  onSave,
  onCancel,
  variant = "default",
}: Props) {
  const [draft, setDraft] = useState<ListRow>(row);

  if (!editing) {
    return <ViewMode row={row} variant={variant} />;
  }

  const isTeam = variant === "team";

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
        <span className="mb-1 block text-muted">{isTeam ? "이메일" : "ID"}</span>
        <input
          aria-label={isTeam ? "이메일" : "ID"}
          value={draft.id}
          onChange={(e) => setDraft({ ...draft, id: e.target.value })}
          className="w-full border border-line bg-cream px-2 py-1 font-mono text-ink"
        />
      </label>
      <label className="block text-xs">
        <span className="mb-1 block text-muted">{isTeam ? "팀" : "담당"}</span>
        {isTeam ? (
          <select
            aria-label="팀"
            value={draft.owner}
            onChange={(e) => setDraft({ ...draft, owner: e.target.value })}
            className="w-full border border-line bg-cream px-2 py-1 text-ink"
          >
            <option value="운영1팀">운영1팀</option>
            <option value="운영2팀">운영2팀</option>
          </select>
        ) : (
          <input
            aria-label="담당"
            value={draft.owner}
            onChange={(e) => setDraft({ ...draft, owner: e.target.value })}
            className="w-full border border-line bg-cream px-2 py-1 text-ink"
          />
        )}
      </label>
      {isTeam && (
        <>
          <label className="block text-xs">
            <span className="mb-1 block text-muted">직급</span>
            <select
              aria-label="직급"
              value={draft.meta ?? ""}
              onChange={(e) => setDraft({ ...draft, meta: e.target.value })}
              className="w-full border border-line bg-cream px-2 py-1 text-ink"
            >
              <option value="부장">부장</option>
              <option value="팀장">팀장</option>
              <option value="TL">TL</option>
              <option value="매니저">매니저</option>
            </select>
          </label>
          <label className="block text-xs">
            <span className="mb-1 block text-muted">
              직속 상사 <span className="text-faint">(미설정 시 자동)</span>
            </span>
            <select
              aria-label="직속 상사"
              value={draft.leader ?? ""}
              onChange={(e) => setDraft({ ...draft, leader: e.target.value })}
              className="w-full border border-line bg-cream px-2 py-1 text-ink"
            >
              <option value="">자동 derive (팀장/부장)</option>
              {OPERATORS.filter((x) => x.email !== draft.id).map((op) => (
                <option key={op.email} value={op.name}>
                  {op.name} · {op.role} · {op.team}
                </option>
              ))}
              <option value="본부장 (외부)">본부장 (외부)</option>
            </select>
          </label>
        </>
      )}
      <label className="block text-xs">
        <span className="mb-1 block text-muted">상태</span>
        <select
          aria-label="상태"
          value={draft.status}
          onChange={(e) =>
            setDraft({ ...draft, status: e.target.value as ListRow["status"] })
          }
          className="w-full border border-line bg-cream px-2 py-1 text-ink"
        >
          <option value="active">활성</option>
          <option value="approved">정상</option>
          <option value="review">점검중 / 비활성</option>
          <option value="urgent">장애 / 정지</option>
        </select>
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
function ViewMode({
  row,
  variant,
}: {
  row: ListRow;
  variant: "default" | "team";
}) {
  return variant === "team" ? <TeamView row={row} /> : <ServiceView row={row} />;
}

function ServiceView({ row }: { row: ListRow }) {
  const statusLabel = STATUS_LABEL[row.status];
  const statusColor = STATUS_BADGE[row.status];

  return (
    <div className="space-y-6">
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

function TeamView({ row }: { row: ListRow }) {
  const statusLabel = STATUS_LABEL[row.status];
  const statusColor = STATUS_BADGE[row.status];
  const op = OPERATORS.find((x) => x.email === row.id);

  // OPERATORS lookup 실패 시 (예: 테스트 더미 데이터) 기존 row 기반 단순 노출.
  if (!op) {
    return (
      <div className="space-y-6">
        <Section title="계정 정보">
          <DefList
            items={[
              { term: "이름", desc: <strong className="font-semibold">{row.name}</strong> },
              { term: "이메일", desc: <span className="font-mono text-xs">{row.id}</span> },
              { term: "소속 팀", desc: row.owner },
              { term: "직급", desc: row.meta ?? "-" },
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
      </div>
    );
  }

  const tenure = tenureLabel(op.hiredAt);
  const tenureY = tenureYears(op.hiredAt);
  const age = ageOf(op.birthDate);

  return (
    <div className="space-y-6">
      <Section title="인사 정보">
        <DefList
          items={[
            { term: "사번", desc: <span className="font-mono">{op.empNo}</span> },
            { term: "이름", desc: <strong className="font-semibold">{op.name}</strong> },
            { term: "성별", desc: op.gender },
            { term: "생년월일", desc: `${op.birthDate} (만 ${age}세)` },
            { term: "본부", desc: op.division },
            { term: "부서", desc: op.department },
            { term: "팀", desc: op.team },
            { term: "직급", desc: op.role },
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

      <Section title="근속 · 계정">
        <DefList
          items={[
            { term: "입사일", desc: op.hiredAt },
            {
              term: "근속",
              desc: (
                <span>
                  {tenure} <span className="text-muted">· {tenureY}년</span>
                </span>
              ),
            },
            { term: "이메일", desc: <span className="font-mono text-xs">{op.email}</span> },
            { term: "권한 레벨", desc: roleToPermission(op.role) },
            { term: "SSO", desc: "Microsoft Entra · 14일 자동 갱신" },
          ]}
        />
      </Section>

      <Divider />

      <Section title="조직 · 보고 라인">
        <DefList
          items={[
            { term: "소속 팀", desc: `${op.team} · ${op.department}` },
            {
              term: "직속 상사",
              desc: row.leader ? row.leader : leaderOf(op),
            },
            { term: "팀 동료", desc: peersOf(op).join(" · ") || "-" },
          ]}
        />
      </Section>
    </div>
  );
}

function roleToPermission(role: string): string {
  switch (role) {
    case "부장":
      return "L4 관리자 · 전체 권한";
    case "팀장":
      return "L3 팀 관리자 · 팀 전체 권한";
    case "TL":
      return "L2 시니어 · 운영 + 검토";
    case "매니저":
      return "L1 운영자 · 운영 권한";
    default:
      return "L0 일반";
  }
}

function leaderOf(op: { team: string; role: string }): string {
  if (op.role === "부장") return "본부장 (외부)";
  if (op.role === "팀장") {
    const head = OPERATORS.find((x) => x.role === "부장");
    return head ? `${head.name} · ${head.role}` : "-";
  }
  // 매니저/TL → 같은 팀 팀장 또는 부장
  const tl = OPERATORS.find((x) => x.team === op.team && x.role === "팀장");
  if (tl) return `${tl.name} · ${tl.role}`;
  const buchang = OPERATORS.find((x) => x.role === "부장");
  return buchang ? `${buchang.name} · ${buchang.role}` : "-";
}

function peersOf(op: { team: string; email: string }): string[] {
  return OPERATORS.filter((x) => x.team === op.team && x.email !== op.email)
    .slice(0, 3)
    .map((x) => x.name);
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
  return <div className="border-t border-line" />;
}
