# Legacy Google Apps Script (참고용)

OPS-Console로 이전되기 전 미수채권 자동화에 쓰이던 **원본 Google Apps Script** 소스를
참고용으로 보관하는 폴더. 빌드/런타임에 포함되지 않는 reference-only 자료.

## 목적
운영자 / 학교담당자 미수 독려 메일의 **원래 발송 규칙**(경과일수 마일스톤,
주말·공휴일 제외 등)을 OPS-Console 코드(`src/features/receivables/*`)로 정확히
복원하기 위한 근거 자료.

## 넣는 방법
이 폴더에 GAS 소스를 그대로 넣어주세요. 확장자는 자유 (`.gs` / `.js` / `.txt`).
예: `docs/legacy-gas/receivables-mail.gs`

관련: [gas-receivables-decommission.md](../gas-receivables-decommission.md)
