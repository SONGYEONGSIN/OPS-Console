import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../auth", () => ({ getGraphToken: vi.fn(async () => "tok") }));

import { uploadFileToFolder } from "../drive-upload";

beforeEach(() => vi.restoreAllMocks());

describe("uploadFileToFolder", () => {
  it("폴더 경로에 PUT content 후 webUrl/itemId 반환", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(
        new Response(
          JSON.stringify({ id: "ITEM123", webUrl: "https://sp/경위서.docx" }),
          { status: 201 },
        ),
      );

    const res = await uploadFileToFolder(
      "DRIVE",
      "FOLDER",
      "경위서.docx",
      Buffer.from("PKzip"),
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    );

    expect(res).toEqual({ itemId: "ITEM123", webUrl: "https://sp/경위서.docx" });
    const calledUrl = fetchMock.mock.calls[0][0] as string;
    expect(calledUrl).toContain("/drives/DRIVE/items/FOLDER:/");
    expect(calledUrl).toContain(encodeURIComponent("경위서.docx"));
    expect(calledUrl).toContain(":/content");
    expect((fetchMock.mock.calls[0][1] as RequestInit).method).toBe("PUT");
  });

  it("실패 응답 → throw", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("nope", { status: 403 }),
    );
    await expect(
      uploadFileToFolder("D", "F", "x.docx", Buffer.from("x"), "application/octet-stream"),
    ).rejects.toThrow(/403/);
  });
});
