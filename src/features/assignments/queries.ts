import "server-only";
import { cache } from "react";
import { getGraphToken } from "@/lib/microsoft/auth";
import type { AssignmentSheet } from "./schemas";

/**
 * 배정 엑셀(SHAREPOINT_ASSIGNMENTS_ITEM_ID, 메인 드라이브)의 특정 워크시트
 * usedRange를 display text로 가져온다. 실패/없음 → null.
 * React cache로 래핑 — 같은 요청 내 동일 워크시트 중복 호출 dedupe.
 */
export const fetchAssignmentSheet = cache(
  async function fetchAssignmentSheet(
    worksheetName: string,
  ): Promise<AssignmentSheet | null> {
    const driveId = process.env.SHAREPOINT_DRIVE_ID;
    const itemId = process.env.SHAREPOINT_ASSIGNMENTS_ITEM_ID;
    if (!driveId || !itemId) {
      console.warn(
        "[assignments] SHAREPOINT_DRIVE_ID / SHAREPOINT_ASSIGNMENTS_ITEM_ID 환경 변수 누락",
      );
      return null;
    }

    let token: string;
    try {
      token = await getGraphToken();
    } catch (e) {
      console.error("[assignments] graph token error:", e);
      return null;
    }

    const base = `https://graph.microsoft.com/v1.0/drives/${driveId}/items/${itemId}/workbook`;
    const enc = encodeURIComponent(worksheetName);
    const res = await fetch(
      `${base}/worksheets('${enc}')/usedRange(valuesOnly=true)?$select=text,rowCount,columnCount`,
      { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" },
    );
    if (!res.ok) {
      console.error(
        `[assignments] usedRange fail (${worksheetName}):`,
        res.status,
        (await res.text()).slice(0, 200),
      );
      return null;
    }
    const data = (await res.json()) as {
      text?: string[][];
      rowCount?: number;
      columnCount?: number;
    };
    const rowsText = (data.text ?? []).map((row) =>
      row.map((c) => String(c ?? "")),
    );
    return {
      worksheetName,
      rowsText,
      rowCount: data.rowCount ?? rowsText.length,
      columnCount: data.columnCount ?? (rowsText[0]?.length ?? 0),
    };
  },
);

/**
 * 배정 엑셀 파일 자체의 driveItem 메타 — webUrl·lastModifiedDateTime.
 * SharePoint 웹으로 위임하는 패널에서 사용.
 */
export type AssignmentItemMeta = {
  webUrl: string;
  lastModifiedDateTime: string | null;
};

export const fetchAssignmentItemMeta = cache(
  async function fetchAssignmentItemMeta(): Promise<AssignmentItemMeta | null> {
    const driveId = process.env.SHAREPOINT_DRIVE_ID;
    const itemId = process.env.SHAREPOINT_ASSIGNMENTS_ITEM_ID;
    if (!driveId || !itemId) return null;
    let token: string;
    try {
      token = await getGraphToken();
    } catch {
      return null;
    }
    const url = `https://graph.microsoft.com/v1.0/drives/${driveId}/items/${itemId}?$select=webUrl,lastModifiedDateTime`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      webUrl?: string;
      lastModifiedDateTime?: string;
    };
    if (!data.webUrl) return null;
    return {
      webUrl: data.webUrl,
      lastModifiedDateTime: data.lastModifiedDateTime ?? null,
    };
  },
);

/** 워크시트 이름 상수 (시트 탭 명과 정확히 일치) */
export const SHEET_NAMES = {
  배정리스트: "02. 배정리스트",
  대학원: "03. 대학원",
  PIMS: "04. PIMS",
  성적산출: "06. 성적산출",
  상담앱: "07. 상담앱",
  업무분장: "(참고) 업무분장",
  가격정책: "(참고) 가격정책",
} as const;
