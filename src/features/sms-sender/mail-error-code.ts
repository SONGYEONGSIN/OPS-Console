const UNKNOWN_CODE = "send_failed";

// sendGraphMail 의 error 는 `코드: 응답본문` 형식 — 본문(주소가 섞일 수 있다)은 버리고 코드만 쓴다.
export function mailErrorCode(error: string): string {
  const m = /^([a-z][a-z0-9_]{0,31}):/.exec(error);
  return m ? m[1] : UNKNOWN_CODE;
}
