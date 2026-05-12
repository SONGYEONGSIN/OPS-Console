import type { ListRow } from "../../../patterns/ListPattern";
import type { ViewProps } from "../types";
import {
  OPERATORS,
  ageOf,
  tenureLabel,
  tenureYears,
} from "@/features/auth/operators";
import { PERMISSION_LABEL } from "@/features/operators/schemas";
import { Section, DefList, Divider } from "../shared";

const STATUS_LABEL: Record<ListRow["status"], string> = {
  urgent: "장애",
  active: "활성",
  review: "점검중",
  approved: "정상",
  inactive: "점검중",
  suspended: "정지",
  deleted: "삭제",
};

const STATUS_BADGE: Record<ListRow["status"], string> = {
  urgent: "bg-vermilion text-cream",
  active: "bg-sage/20 text-sage",
  review: "bg-gold/20 text-gold",
  approved: "bg-line-soft text-muted",
  inactive: "bg-gold/20 text-gold",
  suspended: "bg-vermilion/20 text-vermilion",
  deleted: "bg-ink/20 text-ink-soft",
};

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

export function TeamView({ row }: ViewProps) {
  const statusLabel = STATUS_LABEL[row.status];
  const statusColor = STATUS_BADGE[row.status];
  const op = OPERATORS.find((x) => x.email === row.id);

  if (!op) {
    return (
      <div className="space-y-6">
        <Section title="계정 정보">
          <DefList
            items={[
              { term: "이름", desc: <strong className="font-semibold">{row.name}</strong> },
              { term: "이메일", desc: <span className="font-mono text-xs">{row.id}</span> },
              {
                term: "시스템 권한",
                desc: row.permission ? PERMISSION_LABEL[row.permission] : "-",
              },
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
            {
              term: "시스템 권한",
              desc: row.permission ? PERMISSION_LABEL[row.permission] : "-",
            },
            { term: "직급 권한", desc: roleToPermission(op.role) },
            { term: "SSO", desc: "Microsoft Entra · 14일 자동 갱신" },
          ]}
        />
      </Section>

      <Divider />

      <Section title="조직 · 보고 라인">
        <DefList
          items={[
            { term: "소속 팀", desc: `${op.department} · ${op.team}` },
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
