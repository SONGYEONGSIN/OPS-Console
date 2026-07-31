/**
 * 뉴스레터 공유 URL 단일 정의.
 * 초안 미리보기 · 발행 티저 · 실행 로그가 모두 같은 주소를 써야
 * "확인한 링크 = 팀에 나가는 링크" 불변식이 유지된다.
 */
export function briefingBaseUrl(): string {
  const raw =
    process.env.NEXT_PUBLIC_APP_URL ??
    process.env.FOLIO_BASE_URL ??
    "http://localhost:3000";
  return raw.replace(/\/+$/, "");
}

export function briefingUrl(shareToken: string): string {
  return `${briefingBaseUrl()}/r/briefing/${shareToken}`;
}
