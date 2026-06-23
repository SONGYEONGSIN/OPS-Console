/**
 * 평문 변환된 메일 본문에서 표시 잔재를 제거한다.
 *
 * Graph가 HTML 메일을 `Prefer: outlook.body-content-type="text"`로 평문 변환할 때
 * HTML에선 안 보이던 요소가 텍스트로 노출된다:
 *  - 추적 비콘/읽음확인 1px 이미지 → `[http://.../dsn/123]` 대괄호 bare-URL
 *  - 인라인 이미지 → `[cid:....png]`
 *  - 링크/메일 마크업 → `표시텍스트<mailto:addr>` / `표시텍스트<http://...>`
 *
 * 정상 본문의 대괄호(예: "[진학대학교]")는 보존한다 — bare-URL/cid 만 제거 대상.
 */
export function cleanMailBody(raw: string | null): string | null {
  if (!raw) return raw;
  return raw
    .replace(/\[(?:https?:\/\/|cid:)[^\]]*\]/gi, "") // 대괄호 bare-URL / cid 비콘 제거
    .replace(/<(?:mailto:|https?:\/\/)[^>]*>/gi, "") // 표시텍스트 뒤 링크 마크업 제거
    .replace(/[ \t]+\n/g, "\n") // 잔여 줄 끝 공백 정리
    .replace(/(\r?\n){3,}/g, "\n\n") // 3줄 이상 연속 빈 줄 → 2줄
    .replace(/\r\n/g, "\n") // 줄바꿈 정규화
    .trim();
}
