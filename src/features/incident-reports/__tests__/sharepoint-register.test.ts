import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("@/lib/microsoft/gongmun-ledger", () => ({
  fetchSenderDocNumbers: vi.fn(async () => ["운영2606-0201"]),
  nextDocNumber: vi.fn(() => "운영2606-0202"),
  appendSenderRow: vi.fn(async () => {}),
}));
vi.mock("@/lib/microsoft/drive-upload", () => ({
  uploadFileToFolder: vi.fn(async () => ({
    itemId: "item-1",
    webUrl: "https://sp/x.docx",
  })),
}));
vi.mock("@/lib/docx/incident-report-docx", () => ({
  renderIncidentReportDocx: vi.fn(async () => Buffer.from("PK")),
}));

import {
  registerIncidentReportToSharePoint,
  sharePointConfig,
  DOCX_CONTENT_TYPE,
  type RegisterInput,
} from "../sharepoint-register";
import {
  fetchSenderDocNumbers,
  appendSenderRow,
} from "@/lib/microsoft/gongmun-ledger";
import { uploadFileToFolder } from "@/lib/microsoft/drive-upload";

const REP: RegisterInput = {
  recipient_university: "건국대학교",
  title: "전산파일 오류 건",
  draft_date: "2026-06-02",
  author_name: "나",
  author_email: "me@jinhakapply.com",
  approver_name: null,
  approver_role: null,
  director_name: null,
  director_role: null,
  ceo_name: null,
  ceo_role: null,
  apology: null,
  gyeongwi: null,
  cause: null,
  handling: null,
  handling_rows: [],
  prevention: null,
};

const ENV_KEYS = [
  "SHAREPOINT_DRIVE_ID",
  "SHAREPOINT_GONGMUN_ITEM_ID",
  "SHAREPOINT_INCIDENT_REPORT_FOLDER_ID",
] as const;

function setAllEnv() {
  process.env.SHAREPOINT_DRIVE_ID = "drive-1";
  process.env.SHAREPOINT_GONGMUN_ITEM_ID = "gongmun-1";
  process.env.SHAREPOINT_INCIDENT_REPORT_FOLDER_ID = "folder-1";
}

beforeEach(() => {
  vi.clearAllMocks();
  setAllEnv();
});

afterEach(() => {
  for (const k of ENV_KEYS) delete process.env[k];
});

describe("sharePointConfig", () => {
  it("env 3개 모두 있으면 config 반환", () => {
    expect(sharePointConfig()).toEqual({
      driveId: "drive-1",
      gongmunItemId: "gongmun-1",
      folderItemId: "folder-1",
    });
  });

  it("하나라도 없으면 null", () => {
    delete process.env.SHAREPOINT_GONGMUN_ITEM_ID;
    expect(sharePointConfig()).toBeNull();
  });
});

describe("registerIncidentReportToSharePoint", () => {
  it("Test A: env 설정 → 채번/업로드/행추가 후 결과 반환", async () => {
    const r = await registerIncidentReportToSharePoint(REP, new Date());

    expect(r).toEqual({
      docNumber: "운영2606-0202",
      sharepointUrl: "https://sp/x.docx",
    });

    expect(fetchSenderDocNumbers).toHaveBeenCalledWith(
      "drive-1",
      "gongmun-1",
      expect.any(Number),
    );

    // 업로드: docNumber 포함한 .docx 파일명, DOCX content-type
    expect(uploadFileToFolder).toHaveBeenCalledTimes(1);
    const upArgs = (uploadFileToFolder as ReturnType<typeof vi.fn>).mock
      .calls[0];
    expect(upArgs[0]).toBe("drive-1");
    expect(upArgs[1]).toBe("folder-1");
    const fileName = upArgs[2] as string;
    expect(fileName).toContain("운영2606-0202");
    expect(fileName.endsWith(".docx")).toBe(true);
    expect(upArgs[4]).toBe(DOCX_CONTENT_TYPE);

    // 행추가: recipient/title/link/author 전달
    expect(appendSenderRow).toHaveBeenCalledTimes(1);
    const rowArgs = (appendSenderRow as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(rowArgs[3]).toMatchObject({
      docNumber: "운영2606-0202",
      recipient: "건국대학교",
      title: "전산파일 오류 건",
      link: "https://sp/x.docx",
      author: "나",
    });
  });

  it("Test B: env 누락 → null, 업로드 호출 안 함", async () => {
    delete process.env.SHAREPOINT_INCIDENT_REPORT_FOLDER_ID;
    const r = await registerIncidentReportToSharePoint(REP, new Date());
    expect(r).toBeNull();
    expect(uploadFileToFolder).not.toHaveBeenCalled();
  });

  it("파일명의 SharePoint 금지문자를 제거", async () => {
    const r = await registerIncidentReportToSharePoint(
      { ...REP, title: 'a/b:c*?"<>|d' },
      new Date(),
    );
    expect(r).not.toBeNull();
    const fileName = (uploadFileToFolder as ReturnType<typeof vi.fn>).mock
      .calls[0][2] as string;
    expect(fileName).not.toMatch(/[\\/:*?"<>|]/);
  });
});
