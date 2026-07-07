/**
 * 비용지급일 — SharePoint Excel `NN기비용지급일` 시트 한 행.
 * A=연도 / B=월 / C=일 / D=개인·공용. 운영부 달력에 읽기전용 표시.
 */
export type PaymentDate = {
  /** KST 자연일 YYYY-MM-DD (zero-pad) */
  ymd: string;
  year: number;
  month: number;
  day: number;
  /** D열 원본 값 (예: "개인" / "공용") */
  category: string;
  /** 출처 시트명 (예: "27기비용지급일(26.04~27.03)") */
  sheetName: string;
};
