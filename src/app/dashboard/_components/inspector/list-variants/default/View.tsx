import type { ListRow } from "../../../patterns/ListPattern";
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

/**
 * 서비스 대시보드 인스펙터 — mockup 3섹션 풍부 구조.
 * default variant의 fallback view (운영 메뉴 mock 데이터 포함).
 */
export function ServiceView({ row }: { row: ListRow }) {
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
                <span
                  className={`inline-block px-2 py-0.5 text-xs ${statusColor}`}
                >
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
            {
              term: "에스컬레이션",
              desc: "플랫폼 엔지니어링 (자동 · T+30m)",
            },
          ]}
        />
      </Section>
    </div>
  );
}
