/**
 * PDF 파일명의 학교명 → 현황 파일(xlsm)의 학교명.
 * 이름이 다르게 적힌 6건만 둔다. 여기 없는 이름은 그대로 대조하고, 안 맞으면 '이름 미대조'로 드러난다.
 */
export const PDF_NAME_ALIASES: Readonly<Record<string, string>> = {
  // xlsm 에 연세대 캠퍼스가 (서울) 하나뿐
  연세대학교: "연세대학교(서울)",
  // PDF 내용: 사업자등록증 소재지 서울 성동구 + 재직증명서 소속 '서울' (두 사본 모두)
  한양대학교: "한양대학교(서울)",
  // 이름
  "건국대학교 서울캠퍼스": "건국대학교(서울)",
  // 이름
  "건국대학교 글로컬캠퍼스": "건국대학교(글로컬)",
  // PDF 내용: 사업자등록증 소재지 서울 중구 필동로 — 근거가 한 장뿐(법인 소재지). WISE 는 별도 PDF
  동국대학교: "동국대학교(서울)",
  // 이름
  동국대학교WISE: "동국대학교(WISE)",
};

export function canonicalSchoolName(pdfName: string): string {
  return Object.hasOwn(PDF_NAME_ALIASES, pdfName)
    ? PDF_NAME_ALIASES[pdfName]
    : pdfName;
}
