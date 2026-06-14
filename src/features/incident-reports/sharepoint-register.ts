import "server-only";

import {
  fetchSenderDocNumbers,
  nextDocNumber,
  appendSenderRow,
  updateSenderRowLink,
  deleteSenderRow,
} from "@/lib/microsoft/gongmun-ledger";
import { uploadFileToFolder } from "@/lib/microsoft/drive-upload";
import { renderIncidentReportDocx } from "@/lib/docx/incident-report-docx";
import type { HandlingRow } from "./schemas";

/**
 * 경위서 SharePoint 연동 — 2단계로 분리.
 *
 * 1) assignDocNumber (PDF 버튼 = 발번 시점): 공문관리대장 채번 + 발신 시트 행추가
 *    (F=파일링크는 빈칸). docx 렌더/업로드 없음.
 * 2) uploadAndLinkReportFile (발송 시점): docx(시행번호 포함) 렌더 → 06.경위서 업로드
 *    → 발신 시트 그 행의 F열을 파일 링크로 갱신.
 * env 3개가 모두 설정돼야 동작하며, 하나라도 없으면 null.
 */

export const DOCX_CONTENT_TYPE =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

export type SharePointConfig = {
  driveId: string;
  gongmunItemId: string;
  folderItemId: string;
};

/** env 3개 모두 있으면 config, 하나라도 없으면 null. */
export function sharePointConfig(): SharePointConfig | null {
  const driveId = process.env.SHAREPOINT_DRIVE_ID;
  const gongmunItemId = process.env.SHAREPOINT_GONGMUN_ITEM_ID;
  const folderItemId = process.env.SHAREPOINT_INCIDENT_REPORT_FOLDER_ID;
  if (!driveId || !gongmunItemId || !folderItemId) return null;
  return { driveId, gongmunItemId, folderItemId };
}

export type RegisterInput = {
  recipient_university: string;
  title: string;
  draft_date: string;
  author_name: string;
  author_email: string;
  approver_name: string | null;
  approver_role: string | null;
  director_name: string | null;
  director_role: string | null;
  ceo_name: string | null;
  ceo_role: string | null;
  apology: string | null;
  gyeongwi: string | null;
  cause: string | null;
  handling: string | null;
  handling_rows: HandlingRow[];
  prevention: string | null;
};

/** 파일시스템/SharePoint 금지문자 제거 + trim. 한글은 유지. */
function sanitizeFileName(name: string): string {
  return name.replace(/[\\/:*?"<>|]/g, "").trim();
}

/**
 * 발송 전 미리보기용 시행번호 — 공문관리대장(발신 시트)에서 다음 번호를 "계산만" 한다.
 * 대장에 행을 추가하지 않으므로 확정 아님(다른 발송이 먼저 되면 바뀔 수 있음).
 * config 없거나 조회 실패 시 null.
 */
export async function previewNextDocNumber(
  today: Date,
): Promise<string | null> {
  // 미리보기는 읽기 전용 — 업로드 폴더(SHAREPOINT_INCIDENT_REPORT_FOLDER_ID) 불필요.
  // 공문관리대장(드라이브+item)만 있으면 채번 미리보기 가능.
  const driveId = process.env.SHAREPOINT_DRIVE_ID;
  const gongmunItemId = process.env.SHAREPOINT_GONGMUN_ITEM_ID;
  if (!driveId || !gongmunItemId) {
    console.warn(
      "[previewDocNumber] SharePoint 설정 없음 — SHAREPOINT_DRIVE_ID / SHAREPOINT_GONGMUN_ITEM_ID 확인(dev 서버 재시작 필요)",
    );
    return null;
  }
  try {
    const existing = await fetchSenderDocNumbers(
      driveId,
      gongmunItemId,
      today.getFullYear(),
    );
    return nextDocNumber(existing, today);
  } catch (e) {
    console.error(
      "[previewDocNumber] 공문관리대장 조회 실패 — 발신 시트명/권한 확인:",
      e instanceof Error ? e.message : e,
    );
    return null;
  }
}

/** YYYY-MM-DD 포맷 (로컬 날짜). */
function ymd(today: Date): string {
  const y = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, "0");
  const dd = String(today.getDate()).padStart(2, "0");
  return `${y}-${mm}-${dd}`;
}

/**
 * 발번 — 채번 후 발신대장에 행추가(F=파일링크는 빈칸). docx 렌더/업로드 없음.
 * config 없으면 null.
 */
export async function assignDocNumber(
  rep: RegisterInput,
  today: Date,
  opts?: { ledgerAuthor?: string },
): Promise<{ docNumber: string } | null> {
  // 채번/대장기록은 공문관리대장(드라이브+item)만 있으면 가능 — 업로드 폴더는 발송 시점에만 필요.
  // sharePointConfig(폴더 포함)에 묶으면 폴더 미설정 시 채번이 통째로 무력화되므로 분리한다.
  const driveId = process.env.SHAREPOINT_DRIVE_ID;
  const gongmunItemId = process.env.SHAREPOINT_GONGMUN_ITEM_ID;
  if (!driveId || !gongmunItemId) return null;

  const year = today.getFullYear();
  const existing = await fetchSenderDocNumbers(driveId, gongmunItemId, year);
  const docNumber = nextDocNumber(existing, today);

  await appendSenderRow(driveId, gongmunItemId, year, {
    docNumber,
    date: ymd(today),
    recipient: rep.recipient_university,
    title: rep.title,
    link: "",
    // 대장 작성자 = 사고보고 담당자(ledgerAuthor) 우선, 없으면 리포트 작성자.
    author: opts?.ledgerAuthor?.trim() || rep.author_name,
  });

  return { docNumber };
}

/**
 * 시행번호 회수 — 승인취소 시 공문관리대장(발신 시트)에서 해당 시행번호 행을 삭제한다.
 * 행이 어느 연도 시트에 있는지는 docNumber prefix(운영{YY}{MM}-...)가 기준 —
 * 채번 시 시트가 `(발신){issueYear}년`이고 prefix YY가 곧 issueYear이므로 일치한다.
 * prefix 파싱 실패 시에만 draftDate 연도로 폴백.
 * config(드라이브+공문대장 item) 없으면 false(graceful, throw 금지). 행 없으면 false.
 */
export async function releaseDocNumber(
  docNumber: string,
  draftDate: string,
): Promise<boolean> {
  const driveId = process.env.SHAREPOINT_DRIVE_ID;
  const gongmunItemId = process.env.SHAREPOINT_GONGMUN_ITEM_ID;
  if (!driveId || !gongmunItemId) return false;

  const m = /^운영(\d{2})\d{2}-/.exec(docNumber.trim());
  const year = m ? 2000 + parseInt(m[1], 10) : new Date(draftDate).getFullYear();

  return deleteSenderRow(driveId, gongmunItemId, year, docNumber);
}

/**
 * 파일 업로드 — docx(번호 포함) 렌더 → 06.경위서 업로드 → 발신대장 그 행의 F링크 갱신.
 * config 없으면 null. opts.token으로 위임 토큰 주입.
 */
export async function uploadAndLinkReportFile(
  rep: RegisterInput,
  docNumber: string,
  today: Date,
  opts?: { token?: string },
): Promise<{ sharepointUrl: string } | null> {
  const cfg = sharePointConfig();
  if (!cfg) return null;

  const docx = await renderIncidentReportDocx({
    recipientUniversity: rep.recipient_university,
    title: rep.title,
    draftDate: rep.draft_date,
    authorName: rep.author_name,
    authorEmail: rep.author_email,
    authorPhone: null, // docx는 연락처 줄을 렌더하지 않음
    approverName: rep.approver_name,
    approverRole: rep.approver_role,
    directorName: rep.director_name,
    directorRole: rep.director_role,
    ceoName: rep.ceo_name,
    ceoRole: rep.ceo_role,
    docNumber,
    apology: rep.apology ?? "",
    gyeongwi: rep.gyeongwi,
    cause: rep.cause,
    handling: rep.handling,
    handlingRows: rep.handling_rows,
    prevention: rep.prevention,
  });

  const fileName = sanitizeFileName(`${rep.title}_${docNumber}.docx`);
  const up = await uploadFileToFolder(
    cfg.driveId,
    cfg.folderItemId,
    fileName,
    docx,
    DOCX_CONTENT_TYPE,
    { token: opts?.token },
  );

  await updateSenderRowLink(
    cfg.driveId,
    cfg.gongmunItemId,
    today.getFullYear(),
    docNumber,
    up.webUrl,
  );

  return { sharepointUrl: up.webUrl };
}
