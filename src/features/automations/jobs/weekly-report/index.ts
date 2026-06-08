import "server-only";
import type { AutomationRunResult } from "../../types";
import { sendTeamsChatMessage } from "@/lib/microsoft/teams";
import {
  findReportFolder,
  copyItemAndWait,
  listWorksheetNames,
  renameWorksheet,
  getCellText,
  setCellText,
  createOrgShareLink,
} from "./graph-ops";
import {
  nextWeekFilename,
  nextWeekSheetname,
  weekDateRange,
  formatDateRange,
  senderForWeek,
  subWeekText,
  subDateRange,
  extractMonthWeek,
  buildWeeklyReportMessage,
} from "./rollover-logic";
import { recordWeeklyRun } from "./record";

const REPORT_PREFIX = "주간업무보고서_진학어플라이본부";
// docs/buseobogo.py possible_paths — 순서대로 탐색
const CANDIDATE_PATHS = [
  "General/General",
  "주간업무보고서_진학어플라이본부",
  "General/주간업무보고서",
  "주간업무보고서",
  "진학어플라이본부",
  "업무보고서",
] as const;
const SHEET_RE = /\d{4}년\s*\d+월\s*\d+주차/;
const DATE_RANGE_RE = /\d+\/\d+~\d+\/\d+/;

/** 본부차주보고 알림 — 주간보고서 차주 롤오버 + Teams 공유. */
export async function runWeeklyReportRollover(): Promise<AutomationRunResult> {
  const driveId = process.env.SHAREPOINT_DRIVE_ID;
  if (!driveId) {
    await recordWeeklyRun({
      status: "failed",
      message: "SHAREPOINT_DRIVE_ID 미설정",
    });
    return { ok: false, message: "SHAREPOINT_DRIVE_ID 미설정" };
  }
  const dryRun = process.env.WEEKLY_REPORT_DRY_RUN !== "false";
  const chatId = process.env.TEAMS_CHAT_ID ?? "";
  const senderEmail =
    process.env.WEEKLY_REPORT_SENDER_EMAIL ?? "ys1114@jinhakapply.com";

  // 1. 보고 폴더 + 최신 파일
  const found = await findReportFolder(driveId, CANDIDATE_PATHS, REPORT_PREFIX);
  if (!found) {
    const message = "주간보고 폴더/파일을 찾지 못했습니다.";
    await recordWeeklyRun({ status: "failed", message });
    return { ok: false, message };
  }
  const { folderPath, latest, siblings } = found;

  // 2. 차주 파일명
  const nextName = nextWeekFilename(latest.name);
  if (!nextName) {
    const message = `파일명 패턴 불일치: ${latest.name}`;
    await recordWeeklyRun({ status: "failed", message });
    return { ok: false, message };
  }
  const mw = extractMonthWeek(nextName);
  const yr = Number(/_(\d{4})_/.exec(nextName)?.[1] ?? 0);
  if (!mw || !yr) {
    const message = `차주 파일명 파싱 실패: ${nextName}`;
    await recordWeeklyRun({ status: "failed", fileName: nextName, message });
    return { ok: false, message };
  }
  const sender = senderForWeek(yr, mw.month, mw.week);

  // 3. 멱등 — 차주 파일이 이미 있으면 skip
  if (siblings.some((f) => f.name === nextName)) {
    const message = `이미 차주 파일 존재: ${nextName} (skip)`;
    await recordWeeklyRun({
      status: "skipped",
      year: yr,
      month: mw.month,
      week: mw.week,
      fileName: nextName,
      sender,
      message,
    });
    return { ok: true, message, details: { skipped: 1 } };
  }

  if (dryRun) {
    const message = `[DRY-RUN] ${latest.name} → ${nextName} · 발송자 ${sender} · ${folderPath}`;
    await recordWeeklyRun({
      status: "dry_run",
      year: yr,
      month: mw.month,
      week: mw.week,
      fileName: nextName,
      sender,
      message,
    });
    return { ok: true, message, details: { dryRun: 1 } };
  }

  // 4. 파일 복제(서식 보존)
  const newItemId = await copyItemAndWait(driveId, latest.id, nextName);

  // 5. 워크북 — 최신 시트를 차주 시트로 rename + B2/B3/H3 갱신
  const sheets = await listWorksheetNames(driveId, newItemId);
  const sourceSheet = sheets.find((s) => SHEET_RE.test(s)) ?? sheets[0];
  const newSheet = nextWeekSheetname(sourceSheet);
  // 차주 시트의 B3 = 전주(원본) 시트의 H3 날짜 — rename 전에 읽는다
  const prevH3 = await getCellText(driveId, newItemId, sourceSheet, "H3");
  const prevRange = DATE_RANGE_RE.exec(prevH3)?.[0] ?? "";
  if (newSheet !== sourceSheet) {
    await renameWorksheet(driveId, newItemId, sourceSheet, newSheet);
  }
  // B2: 주차 텍스트 → 차주 시트명
  const b2 = await getCellText(driveId, newItemId, newSheet, "B2");
  await setCellText(
    driveId,
    newItemId,
    newSheet,
    "B2",
    subWeekText(b2, newSheet),
  );
  // B3: 전주 날짜 범위(원본 H3)
  if (prevRange) {
    const b3 = await getCellText(driveId, newItemId, newSheet, "B3");
    await setCellText(
      driveId,
      newItemId,
      newSheet,
      "B3",
      subDateRange(b3, prevRange),
    );
  }
  // H3: 차주 날짜 범위(월~금)
  const { monday, friday } = weekDateRange(yr, mw.month, mw.week);
  const nextRange = formatDateRange(monday, friday);
  const h3 = await getCellText(driveId, newItemId, newSheet, "H3");
  await setCellText(
    driveId,
    newItemId,
    newSheet,
    "H3",
    subDateRange(h3, nextRange),
  );

  // 6. 공유 링크
  const shareLink = await createOrgShareLink(driveId, newItemId);

  // 7. Teams 발송
  let teamsSent = 0;
  if (chatId) {
    const html = buildWeeklyReportMessage({
      month: mw.month,
      week: mw.week,
      sender,
      shareLink,
      fileName: nextName,
    });
    await sendTeamsChatMessage({ operatorEmail: senderEmail, chatId, html });
    teamsSent = 1;
  }

  const message = `차주 보고 생성: ${nextName} · 발송자 ${sender}${chatId ? " · Teams 발송" : " · TEAMS_CHAT_ID 미설정(전송 생략)"}`;
  await recordWeeklyRun({
    status: "created",
    year: yr,
    month: mw.month,
    week: mw.week,
    fileName: nextName,
    sender,
    shareLink,
    teamsSent: teamsSent === 1,
    message,
  });
  return { ok: true, message, details: { created: 1, teamsSent } };
}
