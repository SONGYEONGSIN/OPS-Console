import { z } from "zod";

/**
 * manuals 도메인 schemas (read-only view).
 *
 * SharePoint 메인 드라이브의 `운영부/05. 매뉴얼` 폴더(SHAREPOINT_MANUAL_ITEM_ID)
 * children API 결과 — folder/file 혼합. 편집·다운로드는 SharePoint UI 위임.
 *
 * 표시 그룹: 접두사(A. ~ I.) 자동 추출 + null fallback "기타".
 */

export const manualKindEnum = z.enum(["folder", "file"]);
export type ManualKind = z.infer<typeof manualKindEnum>;

export const manualRowSchema = z.object({
  /** Microsoft Graph driveItem id */
  id: z.string().min(1),
  /** 파일/폴더 이름 (확장자 포함) */
  name: z.string().min(1),
  /** folder | file */
  kind: manualKindEnum,
  /** SharePoint 웹 URL — 행 클릭 시 새 탭 */
  webUrl: z.string().url(),
  /** 부모 driveItem id — 드릴다운 시 현재 폴더 추적 */
  parentItemId: z.string().nullable(),
  /** 접두사 카테고리 (A~I) — 추출 불가 시 null */
  category: z.string().nullable(),
  /** 파일 크기 (bytes) — folder는 null */
  size: z.number().nullable(),
  /** ISO 8601 (UTC) — Graph lastModifiedDateTime */
  lastModifiedDateTime: z.string().nullable(),
  /** 파일 MIME type — folder는 null */
  mimeType: z.string().nullable(),
});

export type ManualRow = z.infer<typeof manualRowSchema>;
