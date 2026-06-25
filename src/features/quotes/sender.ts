/** 견적서 발신자(진학어플라이) 상수. */
export const QUOTE_SENDER = {
  company: "주식회사 진학어플라이",
  ceo: "신원근",
  bizNo: "", // TODO: 운영 확인
  address: "서울특별시 종로구 경희궁길 34 (진학기획B/D 3F)",
  tel: "", // TODO: 운영 확인
  fax: "02-730-0517",
  email: "", // TODO: 운영 확인
} as const;
export type QuoteSender = typeof QUOTE_SENDER;
