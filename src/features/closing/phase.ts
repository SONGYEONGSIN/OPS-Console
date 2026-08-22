/**
 * 서비스 생애주기 — 메뉴가 각 단계를 하나씩 맡는다.
 *
 * | 단계 | 메뉴 | 뜻 |
 * |---|---|---|
 * | `upcoming` | 개발 · 테스트 | 아직 접수 시작 전. 열기 전에 테스트한다 |
 * | `running` | 배포 · 운영 | 접수 중. 지금 돌보는 대상 |
 * | `closed` | 서비스마감 · 전형료정산 | 결제까지 끝남 |
 *
 * **겹치면 안 된다.** 한 서비스가 두 메뉴에 나오면 어디서 처리해야 할지 모른다.
 */

export const PHASES = ["upcoming", "running", "closed"] as const;
export type ServicePhase = (typeof PHASES)[number];

type Dates = {
  write_start_at?: string | null;
  pay_end_at?: string | null;
};

export function phaseOf(s: Dates, now: Date = new Date()): ServicePhase {
  const t = now.getTime();
  const payEnd = s.pay_end_at ? Date.parse(s.pay_end_at) : null;

  // 마감을 먼저 본다. 실제 데이터에 결제마감이 작성시작보다 앞선 건이 있어
  // (강릉영동대 수시1차 — 원본 스크래핑의 연도 오류로 보인다) 순서를 안 정하면
  // 그 한 건이 두 메뉴에 다 나온다.
  if (payEnd !== null && payEnd < t) return "closed";

  const start = s.write_start_at ? Date.parse(s.write_start_at) : null;
  if (start !== null && start > t) return "upcoming";

  // 날짜가 없으면 진행 중으로 둔다 — 어느 목록에도 안 나오면 잊힌다.
  return "running";
}

/** Supabase 쿼리에 단계 조건을 건다. `phaseOf` 와 같은 규칙이어야 한다. */
export function applyPhase<
  T extends {
    lt: (c: string, v: string) => T;
    gte: (c: string, v: string) => T;
    gt: (c: string, v: string) => T;
    lte: (c: string, v: string) => T;
    or: (f: string) => T;
  },
>(query: T, phase: ServicePhase, now: Date = new Date()): T {
  const iso = now.toISOString();
  if (phase === "closed") return query.lt("pay_end_at", iso);
  if (phase === "upcoming") {
    // 마감이 이긴다 — pay_end_at 이 지났으면 시작 전이어도 마감이다.
    return query.gt("write_start_at", iso).gte("pay_end_at", iso);
  }
  // running — 시작했고 결제가 안 끝났다. 날짜가 없는 건도 여기 든다.
  return query
    .gte("pay_end_at", iso)
    .or(`write_start_at.lte.${iso},write_start_at.is.null`);
}
