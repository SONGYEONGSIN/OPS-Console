import "server-only";

import {
  fetchSenderDocNumbers,
  nextDocNumber,
  appendSenderRow,
} from "@/lib/microsoft/gongmun-ledger";
import { uploadFileToFolder } from "@/lib/microsoft/drive-upload";
import { renderIncidentReportDocx } from "@/lib/docx/incident-report-docx";
import type { HandlingRow } from "./schemas";

/**
 * 경위서 발송 시 SharePoint 연동 오케스트레이터 (2차 Phase C).
 *
 * 흐름: 공문관리대장에서 채번 → docx(시행번호 포함) 렌더 → 06.경위서 폴더 업로드
 *       → 발신 시트에 행추가. env 3개가 모두 설정돼야 동작하며, 하나라도 없으면 null.
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
  director_name: string | null;
  ceo_name: string | null;
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
 * 채번 → docx(번호 포함) → 06.경위서 업로드 → 발신대장 행추가.
 * config 없으면 null. opts.token으로 위임 토큰 주입(Phase D).
 */
export async function registerIncidentReportToSharePoint(
  rep: RegisterInput,
  today: Date,
  opts?: { token?: string },
): Promise<{ docNumber: string; sharepointUrl: string } | null> {
  const cfg = sharePointConfig();
  if (!cfg) return null;

  const year = today.getFullYear();
  const existing = await fetchSenderDocNumbers(
    cfg.driveId,
    cfg.gongmunItemId,
    year,
  );
  const docNumber = nextDocNumber(existing, today);

  const docx = await renderIncidentReportDocx({
    recipientUniversity: rep.recipient_university,
    title: rep.title,
    draftDate: rep.draft_date,
    authorName: rep.author_name,
    authorEmail: rep.author_email,
    approverName: rep.approver_name,
    directorName: rep.director_name,
    ceoName: rep.ceo_name,
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

  const y = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, "0");
  const dd = String(today.getDate()).padStart(2, "0");
  const dateStr = `${y}-${mm}-${dd}`;

  await appendSenderRow(cfg.driveId, cfg.gongmunItemId, year, {
    docNumber,
    date: dateStr,
    recipient: rep.recipient_university,
    title: rep.title,
    link: up.webUrl,
    author: rep.author_name,
  });

  return { docNumber, sharepointUrl: up.webUrl };
}
