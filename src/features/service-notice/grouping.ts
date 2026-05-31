import type { ServiceNoticeGroup, ServiceNoticeService } from "./schemas";

/**
 * 다음 달 작성시작 서비스를 운영자 이메일별로 묶는다.
 * - operatorEmail 없는 행은 제외
 * - 각 그룹은 writeStartAt 오름차순 정렬 (메일 표 순서)
 * - operatorName 없으면 이메일로 폴백
 */
export function groupServicesByOperator(
  services: ServiceNoticeService[],
): ServiceNoticeGroup[] {
  const byEmail = new Map<string, ServiceNoticeService[]>();
  for (const s of services) {
    if (!s.operatorEmail) continue;
    const list = byEmail.get(s.operatorEmail) ?? [];
    list.push(s);
    byEmail.set(s.operatorEmail, list);
  }
  return Array.from(byEmail.entries()).map(([email, list]) => ({
    operator: {
      email,
      name: list.find((s) => s.operatorName)?.operatorName ?? email,
    },
    services: [...list].sort((a, b) =>
      a.writeStartAt < b.writeStartAt
        ? -1
        : a.writeStartAt > b.writeStartAt
          ? 1
          : 0,
    ),
  }));
}
