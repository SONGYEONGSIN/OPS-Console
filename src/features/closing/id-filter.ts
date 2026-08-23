/**
 * 서비스ID 목록으로 거르기.
 *
 * `service_billing` 은 `closing_services` 와 FK 가 없다 — 스크랩 미러라 FK 를 걸면
 * 이력 무결성이 스크래퍼에 묶인다. 그래서 DB 조인 대신 ID 목록을 주고받는다.
 *
 * 목록 크기는 **마감된 서비스 수**를 넘지 않는다(현재 572). 마감 서비스는 해마다
 * 쌓이므로 수천을 넘어가면 이 방식 대신 DB 함수(RPC)로 옮겨야 한다.
 */
export function applyServiceIdFilter<
  T extends {
    in: (c: string, v: readonly number[]) => T;
    eq: (c: string, v: number) => T;
    not: (c: string, op: string, v: string) => T;
  },
>(
  query: T,
  filter: {
    serviceIds?: readonly number[];
    excludeServiceIds?: readonly number[];
  },
): T {
  let q = query;

  if (filter.serviceIds) {
    // 빈 목록은 '아무것도 없음'이다 — 필터 없음(undefined)과 다르다. 정산완료가
    // 0건일 때 마감 서비스가 통째로 쏟아지면 발행 대상이 아닌 걸 발행하게 된다.
    // PostgREST 는 빈 in() 을 거부하므로 있을 수 없는 ID 로 빈 결과를 만든다.
    q = filter.serviceIds.length === 0
      ? q.eq("service_id", -1)
      : q.in("service_id", [...filter.serviceIds]);
  }

  if (filter.excludeServiceIds && filter.excludeServiceIds.length > 0) {
    q = q.not("service_id", "in", `(${filter.excludeServiceIds.join(",")})`);
  }

  return q;
}
