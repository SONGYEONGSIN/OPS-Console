import type { RawPdf, RawSource } from "../types";

const pad = (head: string[]) => [...head, ...Array(20 - head.length).fill(""), "고를 값"];

export const SCHOOL_HEADER = ["No", "학교명", "구분", "원서접수", "PIMS", "담당자", "등록 회선", "일괄 등록", "추가 등록", "서류 미비", "최근 등록일", "제출 서류 (10/15 기준)", "확인", "비고", "", "", "", "", "", "", "고를 값"];
export const DOCS_HEADER = ["No", "학교명", "구분", "등록 회선\n(03 번호 목록)", "세종 등록 상태", "신청서", "위임장", "이용증명원", "사업자등록증", "법인인감", "재직증명서", "신분증", "위탁계약서", "제출 상태\n(10/15 기준)", "미제출 서류", "", "", "PDF 주소", "", "", "고를 값"];
export const NUMBER_HEADER = pad(["No", "학교명", "구분", "발신번호", "상태", "등록일자", "제출 서류 (10/15 기준)", "비고"]);
export const CHECK_HEADER = pad(["No", "유형", "대상", "내용", "근거", "할 일"]);

type Over = Record<string, unknown>;

const norm = (h: string) => h.split("\n")[0].replace(/\s*\([^)]*\)$/, "").replace(/\s+/g, " ").trim();

// over 의 키는 헤더 원문 또는 정규화한 이름. 헤더가 빈 칸인 열은 byIndex 로 넣는다.
const build = (header: string[], defaults: Over, over: Over, byIndex: Record<number, unknown> = {}): unknown[] =>
  header.map((h, i) => {
    if (i in byIndex) return byIndex[i];
    const names = [h, norm(h)].filter(Boolean);
    const okey = names.find((k) => k in over);
    if (okey) return over[okey];
    const dkey = names.find((k) => k in defaults);
    return dkey ? defaults[dkey] : "";
  });

export const schoolRow = (no: number, name: string, over: Over = {}) =>
  build(
    SCHOOL_HEADER,
    {
      No: no, 학교명: name, 구분: "4년제", 원서접수: "O", PIMS: "", 담당자: "[담당자]",
      "등록 회선": 2, "일괄 등록": 2, "추가 등록": 0, "서류 미비": 0, "최근 등록일": "-",
      "제출 서류": "1종 미제출 (신분증)", 확인: "", 비고: "",
    },
    over,
    { 20: "전문대학" },
  );

export const docsRow = (no: number, name: string, over: Over = {}) =>
  build(
    DOCS_HEADER,
    {
      No: no, 학교명: name, 구분: "4년제", "등록 회선": 2, "세종 등록 상태": "등록 완료",
      신청서: "O", 위임장: "O", 이용증명원: "O", 사업자등록증: "O", 법인인감: "O", 재직증명서: "O", 신분증: "✕", 위탁계약서: "O",
      "제출 상태": "1종 미제출", "미제출 서류": "신분증", "PDF 주소": "https://example.invalid/x.pdf",
    },
    over,
    { 15: no, 19: "|미제출 있음|" },
  );

export const numberRow = (no: number, school: string, number: string, over: Over = {}) =>
  build(
    NUMBER_HEADER,
    { No: no, 학교명: school, 구분: "4년제", 발신번호: number, 상태: "일괄 등록", 등록일자: "-", "제출 서류": "보완 필요: 신분증", 비고: "" },
    over,
  );

export const checkRow = (no: number, kind: string, target: string, over: Over = {}) =>
  build(CHECK_HEADER, { No: no, 유형: kind, 대상: target, 내용: "내용", 근거: "근거", "할 일": "할 일" }, over);

export const pdf = (folder: string, school: string, over: Partial<RawPdf> = {}): RawPdf => ({
  id: `id-${folder}-${school}`,
  name: `(${school}) SMS 발신용 대학 전화번호 등록 서류.pdf`,
  webUrl: `https://example.invalid/${folder}/${school}`,
  size: 1000,
  lastModifiedDateTime: "2026-10-19T00:47:30Z",
  folder,
  ...over,
});

export const rawSource = (over: Partial<RawSource> = {}): RawSource => ({
  workbook: {
    id: "wb1",
    name: "SMS 발신번호 사전등록 현황_261017.xlsm",
    webUrl: "https://example.invalid/wb",
    size: 5000,
    lastModifiedDateTime: "2026-10-17T00:00:00Z",
  },
  offRuleFiles: [],
  sheets: {
    schools: [
      SCHOOL_HEADER,
      schoolRow(1, "가나대학교"),
      schoolRow(2, "다라대학교"),
      schoolRow(3, "마바전문대학", { 구분: "전문대학" }),
    ],
    docs: [DOCS_HEADER, docsRow(1, "가나대학교"), docsRow(2, "다라대학교"), docsRow(3, "마바전문대학", { 구분: "전문대학" })],
    numbers: [
      NUMBER_HEADER,
      numberRow(1, "가나대학교", "02-0000-0001"),
      numberRow(2, "다라대학교", "02-0000-0002"),
      numberRow(3, "마바전문대학", "02-0000-0003", { 구분: "전문대학" }),
    ],
    checks: [CHECK_HEADER, checkRow(1, "번호 확인", "가나대학교\n02-0000-0001")],
  },
  criteria: null,
  pdfs: [pdf("완료/제출완료/접수", "가나대학교")],
  fetchedAt: "2026-10-26T00:05:00Z",
  ...over,
});
