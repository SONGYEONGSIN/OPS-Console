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
  authorPhone: string | null;
  approverName: string | null;
  approverRole: string | null;
  directorName: string | null;
  directorRole: string | null;
  ceoName: string | null;
  ceoRole: string | null;
  docNumber: string | null;
  apology: string | null;
  /** 공문 1번 인사말 — 미설정 시 수신대학 기반 자동 문구. */
  greeting?: string | null;
  /** 공문 3번 맺음말 — 미설정 시 "감사합니다.". */
  closing?: string | null;
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

/** 목록 항목 시작 — "1)" "2." "- " "• " 등. 이런 줄은 항상 새 줄로 유지. */
const LIST_MARKER = /^\s*(\d+[).]|[-–—•▪·])/;
/** 문장 종료 — 마침표/물음표/느낌표/콜론(닫는 따옴표·괄호 허용). */
const SENTENCE_END = /[.!?:]["')\]]?\s*$/;

/**
 * 본문 텍스트를 줄 단위로 분해. '-'로 시작하는 줄(세부 항목)은 indent=true로 표시해
 * 1)·2) 상위 항목 아래로 들여쓰기 렌더한다. 처리 표(rows)에는 적용하지 않는다.
 *
 * 또한 **문장 중간에 끊긴 하드 개행을 복원**한다: 직전 줄이 문장 부호로 끝나지 않고
 * 현재 줄이 목록 항목/빈 줄이 아니면, 사용자가 의도하지 않은 소프트 줄바꿈으로 보고
 * 한 줄로 이어붙인다(공문에서 폭이 남는데 줄이 끊기는 현상 방지). 목록·문단 구분 개행은 유지.
 * HTML 미리보기(FormPage)와 PDF가 공유.
 */
export function bodyLines(body: string): { text: string; indent: boolean }[] {
  const merged: string[] = [];
  for (const line of body.split("\n")) {
    const prev = merged[merged.length - 1];
    const joinable =
      prev !== undefined &&
      prev.trim() !== "" &&
      line.trim() !== "" &&
      !LIST_MARKER.test(line) &&
      !SENTENCE_END.test(prev);
    if (joinable) {
      merged[merged.length - 1] = `${prev.replace(/\s+$/, "")} ${line.trim()}`;
    } else {
      merged.push(line);
    }
  }
  return merged.map((text) => ({
    text,
    indent: text.trimStart().startsWith("-"),
  }));
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
  // 1번 인사말·3번 맺음말 — 입력값 우선, 없으면 자동/기본 문구로 폴백.
  const greetingLine =
    s.greeting && s.greeting.trim()
      ? s.greeting
      : `${s.recipientUniversity}의 무궁한 발전을 기원합니다.`;
  const closingLine = s.closing && s.closing.trim() ? s.closing : "감사합니다.";
  return {
    brandHeader: BRAND_HEADER,
    recipientUniversity: s.recipientUniversity,
    title: s.title,
    apology: apologyResolved,
    coverBody: [greetingLine, apologyBodyOnly(apologyResolved), closingLine],
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
      `전 화 ${s.authorPhone?.trim() || "(02)2013-0669"} ㅣ 전 송 (02)722-5453 ㅣ 이메일 ${s.authorEmail} ㅣ 공 개`,
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
