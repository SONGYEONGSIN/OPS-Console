import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("@/lib/microsoft/gongmun-ledger", () => ({
  fetchSenderDocNumbers: vi.fn(async () => ["운영2606-0201"]),
  nextDocNumber: vi.fn(() => "운영2606-0202"),
  appendSenderRow: vi.fn(async () => {}),
  updateSenderRowLink: vi.fn(async () => true),
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
  assignDocNumber,
  uploadAndLinkReportFile,
  sharePointConfig,
  DOCX_CONTENT_TYPE,
  type RegisterInput,
} from "../sharepoint-register";
import {
  fetchSenderDocNumbers,
  appendSenderRow,
  updateSenderRowLink,
} from "@/lib/microsoft/gongmun-ledger";
import { uploadFileToFolder } from "@/lib/microsoft/drive-upload";
import { renderIncidentReportDocx } from "@/lib/docx/incident-report-docx";

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

describe("assignDocNumber", () => {
  it("채번 후 발신대장에 link 빈칸으로 행추가 + docNumber 반환", async () => {
    const r = await assignDocNumber(REP, new Date());

    expect(r).toEqual({ docNumber: "운영2606-0202" });

    expect(fetchSenderDocNumbers).toHaveBeenCalledWith(
      "drive-1",
      "gongmun-1",
      expect.any(Number),
    );

    // 행추가: link="" 빈칸, recipient/title/author 전달, 업로드는 없음
    expect(appendSenderRow).toHaveBeenCalledTimes(1);
    const rowArgs = (appendSenderRow as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(rowArgs[0]).toBe("drive-1");
    expect(rowArgs[1]).toBe("gongmun-1");
    expect(rowArgs[3]).toMatchObject({
      docNumber: "운영2606-0202",
      recipient: "건국대학교",
      title: "전산파일 오류 건",
      link: "",
      author: "나",
    });

    // 발번 단계는 docx 렌더/업로드를 하지 않는다
    expect(renderIncidentReportDocx).not.toHaveBeenCalled();
    expect(uploadFileToFolder).not.toHaveBeenCalled();
  });

  it("env 누락(gongmun) → null, 채번/행추가 호출 안 함", async () => {
    delete process.env.SHAREPOINT_GONGMUN_ITEM_ID;
    const r = await assignDocNumber(REP, new Date());
    expect(r).toBeNull();
    expect(fetchSenderDocNumbers).not.toHaveBeenCalled();
    expect(appendSenderRow).not.toHaveBeenCalled();
  });

  it("업로드 폴더(FOLDER_ID) 없어도 채번/대장기록은 동작 — 채번은 폴더 불필요", async () => {
    delete process.env.SHAREPOINT_INCIDENT_REPORT_FOLDER_ID;
    const r = await assignDocNumber(REP, new Date());
    expect(r).toEqual({ docNumber: "운영2606-0202" });
    expect(appendSenderRow).toHaveBeenCalledTimes(1);
  });

  it("opts.ledgerAuthor가 있으면 대장 작성자로 사용(사고 담당자)", async () => {
    await assignDocNumber(REP, new Date(), { ledgerAuthor: "김지현" });
    const rowArgs = (appendSenderRow as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(rowArgs[3]).toMatchObject({ author: "김지현" });
  });

  it("ledgerAuthor가 비면 rep.author_name으로 폴백", async () => {
    await assignDocNumber(REP, new Date(), { ledgerAuthor: "  " });
    const rowArgs = (appendSenderRow as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(rowArgs[3]).toMatchObject({ author: "나" });
  });
});

describe("uploadAndLinkReportFile", () => {
  it("docx 렌더 → 업로드 → 발신대장 F링크 갱신 후 sharepointUrl 반환", async () => {
    const r = await uploadAndLinkReportFile(REP, "운영2606-0202", new Date());

    expect(r).toEqual({ sharepointUrl: "https://sp/x.docx" });

    // docx는 docNumber 포함해 렌더
    expect(renderIncidentReportDocx).toHaveBeenCalledTimes(1);
    const docxArg = (renderIncidentReportDocx as ReturnType<typeof vi.fn>).mock
      .calls[0][0] as Record<string, unknown>;
    expect(docxArg.docNumber).toBe("운영2606-0202");

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

    // 발신대장: 같은 docNumber 행의 F열을 업로드 webUrl로 갱신
    expect(updateSenderRowLink).toHaveBeenCalledTimes(1);
    const linkArgs = (updateSenderRowLink as ReturnType<typeof vi.fn>).mock
      .calls[0];
    expect(linkArgs[0]).toBe("drive-1");
    expect(linkArgs[1]).toBe("gongmun-1");
    expect(linkArgs[3]).toBe("운영2606-0202");
    expect(linkArgs[4]).toBe("https://sp/x.docx");
  });

  it("env 누락 → null, 업로드 호출 안 함", async () => {
    delete process.env.SHAREPOINT_INCIDENT_REPORT_FOLDER_ID;
    const r = await uploadAndLinkReportFile(REP, "운영2606-0202", new Date());
    expect(r).toBeNull();
    expect(uploadFileToFolder).not.toHaveBeenCalled();
  });

  it("opts.token을 업로드에 전달", async () => {
    await uploadAndLinkReportFile(REP, "운영2606-0202", new Date(), {
      token: "delegated-tok",
    });
    const upArgs = (uploadFileToFolder as ReturnType<typeof vi.fn>).mock
      .calls[0];
    expect(upArgs[5]).toMatchObject({ token: "delegated-tok" });
  });

  it("파일명의 SharePoint 금지문자를 제거", async () => {
    await uploadAndLinkReportFile(
      { ...REP, title: 'a/b:c*?"<>|d' },
      "운영2606-0202",
      new Date(),
    );
    const fileName = (uploadFileToFolder as ReturnType<typeof vi.fn>).mock
      .calls[0][2] as string;
    expect(fileName).not.toMatch(/[\\/:*?"<>|]/);
  });
});
