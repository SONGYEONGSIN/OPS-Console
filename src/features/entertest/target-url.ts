/**
 * 테스트 실행 대상 URL — 접수구분(closing_services.admission_type)에 따라
 * 원서접수 테스트 시스템이 갈린다. 공통원서는 nstest, 그 외는 entertest.
 *
 * 분류가 비어 있으면 다수(반응형원서) 쪽인 entertest로 둔다 —
 * Moa 엑셀에 접수구분이 안 채워진 건이 있어 스크래핑 결과에 빈 값이 섞인다.
 *
 * 폴러(scripts/entertest/test_run.py)는 이 URL에서 origin을 파싱해 쓰므로
 * 호스트가 바뀌어도 스크립트는 그대로 동작한다.
 */
export function buildEntertestTargetUrl(
  serviceId: number,
  admissionType: string | null | undefined,
): string {
  const host =
    admissionType?.trim() === "공통원서"
      ? "nstest.jinhakapply.com"
      : "entertest.jinhakapply.com";
  return `https://${host}/Notice/${serviceId}/A`;
}
