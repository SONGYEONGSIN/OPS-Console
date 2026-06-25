/** 견적서 발신자(진학어플라이) 상수. */
export const QUOTE_SENDER = {
  company: "주식회사 진학어플라이",
  ceo: "신원근",
  bizNo: "101-86-62676",
  address: "서울 종로구 경희궁길 34 진학기획빌딩",
  tel: "", // 회사 대표번호 미상 — 담당자 연락처는 header
  fax: "",
  email: "",
} as const;
export type QuoteSender = typeof QUOTE_SENDER;
