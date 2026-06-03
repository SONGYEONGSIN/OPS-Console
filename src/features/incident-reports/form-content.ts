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
  approverRole: string | null;
  directorName: string | null;
  directorRole: string | null;
  ceoName: string | null;
  ceoRole: string | null;
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

/** 공문 본문 2번 항목용 — 사과 텍스트에서 선두 인사말과 말미 "감사합니다"를 제거. */
function apologyBodyOnly(text: string): string {
  return text
    .trim()
    .replace(/^[^\n]*무궁한 발전을 기원합니다\.?\s*/, "")
    .replace(/\s*감사합니다\.?\s*$/, "")
    .trim();
}

/** draftDate("2026-06-02" | "2025. 02. 13") → "MM/DD". 숫자 그룹이 3개 미만이면 "". */
export function jeonkyeolDate(draftDate: string): string {
  const nums = draftDate.match(/\d+/g);
  if (!nums || nums.length < 3) return "";
  const [, mm, dd] = nums;
  return `${mm.padStart(2, "0")}/${dd.padStart(2, "0")}`;
}

/** draftDate → "YYYY. MM. DD" (접수일자 표기). 파싱 실패 시 원본 반환. */
export function formatYmd(draftDate: string): string {
  const nums = draftDate.match(/\d+/g);
  if (!nums || nums.length < 3) return draftDate;
  const [y, mm, dd] = nums;
  return `${y}. ${mm.padStart(2, "0")}. ${dd.padStart(2, "0")}`;
}

export type FormModel = {
  brandHeader: string;
  recipientUniversity: string;
  title: string;
  apology: string;
  /** 공문 번호 본문 — [인사말, 사과 본문, "감사합니다."] (실제 양식 1./2./3.) */
  coverBody: readonly string[];
  attachment: string;
  companyLine: string;
  jeonkyeolDate: string;
  /** 접수일자 "YYYY. MM. DD" (작성일 기준) */
  receiptDate: string;
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
  const apologyResolved =
    s.apology && s.apology.trim()
      ? s.apology
      : defaultApology(s.recipientUniversity);
  const greetingLine = `${s.recipientUniversity}의 무궁한 발전을 기원합니다.`;
  return {
    brandHeader: BRAND_HEADER,
    recipientUniversity: s.recipientUniversity,
    title: s.title,
    apology: apologyResolved,
    coverBody: [greetingLine, apologyBodyOnly(apologyResolved), "감사합니다."],
    attachment: `붙임 : 1. ${s.title} 경위서 1부.  끝.`,
    companyLine: COMPANY_LINE,
    jeonkyeolDate: jeonkyeolDate(s.draftDate),
    receiptDate: formatYmd(s.draftDate),
    // 담당자(기안자)는 고정 라벨, 나머지는 실제 직책(없으면 기본 라벨 폴백).
    // 작성자가 곧 팀장이면(기안자=결재 팀장) 담당자 칸은 생략한다.
    approvalLine: [
      ...(s.approverName && s.authorName === s.approverName
        ? []
        : [{ role: "담당자", name: s.authorName }]),
      { role: s.approverRole || "팀장", name: s.approverName ?? "" },
      { role: s.directorRole || "본부장", name: s.directorName ?? "" },
      { role: s.ceoRole || "사장", name: s.ceoName ?? "" },
    ],
    docNumber: s.docNumber,
    contactLines: [
      ADDRESS_LINE,
      `전 화 (02)2013-0669 ㅣ 전 송 (02)722-5453 ㅣ 이메일 ${s.authorEmail} ㅣ 공 개`,
    ],
    draftDate: formatYmd(s.draftDate),
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
