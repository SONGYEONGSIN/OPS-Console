// 경위서 양식 콘텐츠 단일 소스 — HTML 미리보기(client)와 PDF 렌더러(server)가 공유한다.
// server-only 금지: 양쪽에서 import.
import { defaultApology } from "./apology";
import type { HandlingRow } from "./schemas";

export type FormSource = {
  recipientUniversity: string;
  title: string;
  draftDate: string;
  authorName: string;
  authorEmail: string;
  approverName: string | null;
  directorName: string | null;
  ceoName: string | null;
  docNumber: string | null;
  apology: string | null;
  gyeongwi: string | null;
  cause: string | null;
  handling: string | null;
  handlingRows: readonly HandlingRow[];
  prevention: string | null;
};

export const BRAND_HEADER =
  "대한민국 대표 원서접수 사이트 진학어플라이 · 대한민국 최대 입시전문 포탈사이트 진학닷컴";
export const COMPANY_LINE = "(주)진학어플라이 대표이사";
/** 주소·홈페이지 줄 (고정). 전화/이메일 줄은 작성자 이메일을 넣어 동적 생성. */
export const ADDRESS_LINE =
  "주 소 (우)03175 서울시 종로구 경복궁길 34 진학기획빌딩 ㅣ 홈페이지 www.jinhakapply.com";
export const CLOSING =
  "이번 오류로 업무에 불편을 드린 점 거듭 사과드립니다. 향후 이러한 문제가 다시 발생하지 않도록 하겠습니다.";

const SECTION_LABELS = ["경위", "원인", "처리", "향후 대책"] as const;

/** draftDate("2026-06-02" | "2025. 02. 13") → "MM/DD". 숫자 그룹이 3개 미만이면 "". */
export function jeonkyeolDate(draftDate: string): string {
  const nums = draftDate.match(/\d+/g);
  if (!nums || nums.length < 3) return "";
  const [, mm, dd] = nums;
  return `${mm.padStart(2, "0")}/${dd.padStart(2, "0")}`;
}

export type FormModel = {
  brandHeader: string;
  recipientUniversity: string;
  title: string;
  apology: string;
  attachment: string;
  companyLine: string;
  jeonkyeolDate: string;
  approvalLine: readonly { role: string; name: string }[];
  docNumber: string | null;
  contactLines: readonly string[];
  draftDate: string;
  authorName: string;
  sections: readonly {
    no: number;
    label: string;
    body: string;
    /** "3. 처리"만: 시간/내용 2열 표. 비어있으면 body(text) 폴백. */
    rows?: readonly HandlingRow[];
  }[];
  closing: string;
};

export function deriveFormModel(s: FormSource): FormModel {
  return {
    brandHeader: BRAND_HEADER,
    recipientUniversity: s.recipientUniversity,
    title: s.title,
    apology:
      s.apology && s.apology.trim()
        ? s.apology
        : defaultApology(s.recipientUniversity),
    attachment: `붙임 : 1. ${s.title} 경위서 1부.  끝.`,
    companyLine: COMPANY_LINE,
    jeonkyeolDate: jeonkyeolDate(s.draftDate),
    approvalLine: [
      { role: "담당자", name: s.authorName },
      { role: "팀장", name: s.approverName ?? "" },
      { role: "본부장", name: s.directorName ?? "" },
      { role: "사장", name: s.ceoName ?? "" },
    ],
    docNumber: s.docNumber,
    contactLines: [
      ADDRESS_LINE,
      `전 화 (02)2013-0669 ㅣ 전 송 (02)722-5453 ㅣ 이메일 ${s.authorEmail} ㅣ 공 개`,
    ],
    draftDate: s.draftDate,
    authorName: s.authorName,
    sections: [
      { no: 1, label: SECTION_LABELS[0], body: s.gyeongwi ?? "" },
      { no: 2, label: SECTION_LABELS[1], body: s.cause ?? "" },
      {
        no: 3,
        label: SECTION_LABELS[2],
        body: s.handling ?? "",
        rows: s.handlingRows,
      },
      { no: 4, label: SECTION_LABELS[3], body: s.prevention ?? "" },
    ],
    closing: CLOSING,
  };
}
