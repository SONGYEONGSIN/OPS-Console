import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../auth", () => ({ getGraphToken: vi.fn(async () => "tok") }));

import {
  uploadFileToFolder,
  uploadLargeFileToFolder,
  ensureFolder,
} from "../drive-upload";

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

/**
 * 단순 PUT 은 4MB 미만 전용이다. 지식망에 넣으려는 파일은 그보다 크다 —
 * 처음 들어온 통합 규정집이 6.2MB 였다.
 */
describe("uploadLargeFileToFolder", () => {
  it("업로드 세션을 열고 조각으로 나눠 올린다", async () => {
    const calls: { url: string; init: RequestInit }[] = [];
    vi.spyOn(globalThis, "fetch").mockImplementation((async (
      url: string,
      init: RequestInit,
    ) => {
      calls.push({ url: String(url), init });
      if (String(url).includes("createUploadSession")) {
        return new Response(
          JSON.stringify({ uploadUrl: "https://up/session" }),
          { status: 200 },
        );
      }
      // 마지막 조각에서만 driveItem 이 온다 — 끝 오프셋이 전체-1 일 때.
      const range = String((init.headers as Record<string, string>)["Content-Range"]);
      const m = /bytes \d+-(\d+)\/(\d+)/.exec(range)!;
      const done = Number(m[1]) === Number(m[2]) - 1;
      return new Response(
        done
          ? JSON.stringify({ id: "ITEM9", webUrl: "https://sp/큰파일.pdf" })
          : "{}",
        { status: done ? 201 : 202 },
      );
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    }) as any);

    const res = await uploadLargeFileToFolder(
      "DRIVE",
      "FOLDER",
      "큰파일.pdf",
      Buffer.from("0123456789"),
      { chunkSize: 4 },
    );

    expect(res).toEqual({ itemId: "ITEM9", webUrl: "https://sp/큰파일.pdf" });
    expect(calls[0].url).toContain("/drives/DRIVE/items/FOLDER:/");
    expect(calls[0].url).toContain("createUploadSession");
    // 10바이트를 4바이트씩 → 3조각
    const ranges = calls
      .slice(1)
      .map((c) => (c.init.headers as Record<string, string>)["Content-Range"]);
    expect(ranges).toEqual([
      "bytes 0-3/10",
      "bytes 4-7/10",
      "bytes 8-9/10",
    ]);
  });

  it("같은 이름이 있어도 남의 파일을 덮지 않는다", async () => {
    const bodies: string[] = [];
    vi.spyOn(globalThis, "fetch").mockImplementation((async (
      url: string,
      init: RequestInit,
    ) => {
      if (String(url).includes("createUploadSession")) {
        bodies.push(String(init.body));
        return new Response(JSON.stringify({ uploadUrl: "https://up/s" }), {
          status: 200,
        });
      }
      return new Response(JSON.stringify({ id: "I", webUrl: "https://sp/x" }), {
        status: 201,
      });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    }) as any);

    await uploadLargeFileToFolder("D", "F", "x.pdf", Buffer.from("ab"));
    expect(bodies[0]).toContain("rename");
  });

  it("세션을 못 열면 throw — 조용히 빈 링크를 주지 않는다", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("nope", { status: 403 }),
    );
    await expect(
      uploadLargeFileToFolder("D", "F", "x.pdf", Buffer.from("ab")),
    ).rejects.toThrow();
  });
});

/**
 * 올릴 자리를 사람이 찾아 env 에 넣게 하면, 안 넣은 채로 기능이 죽는다.
 * 이미 아는 폴더(볼트 루트) 밑에 필요할 때 만든다.
 */
describe("ensureFolder", () => {
  it("이미 있으면 그 폴더를 쓴다 — 매번 만들지 않는다", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          value: [
            { name: "규칙", id: "R", folder: { childCount: 3 } },
            { name: "첨부", id: "A", folder: { childCount: 0 } },
          ],
        }),
        { status: 200 },
      ),
    );
    expect(await ensureFolder("D", "VAULT", "첨부")).toBe("A");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("없으면 만든다", async () => {
    const calls: RequestInit[] = [];
    vi.spyOn(globalThis, "fetch").mockImplementation((async (
      _url: string,
      init: RequestInit,
    ) => {
      calls.push(init);
      if (init?.method === "POST") {
        return new Response(JSON.stringify({ id: "NEW" }), { status: 201 });
      }
      return new Response(JSON.stringify({ value: [] }), { status: 200 });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    }) as any);

    expect(await ensureFolder("D", "VAULT", "첨부")).toBe("NEW");
    const post = calls.find((c) => c.method === "POST")!;
    expect(String(post.body)).toContain("첨부");
    expect(String(post.body)).toContain("folder");
  });

  it("같은 이름의 파일은 폴더로 치지 않는다", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation((async (
      _url: string,
      init: RequestInit,
    ) => {
      if (init?.method === "POST") {
        return new Response(JSON.stringify({ id: "NEW" }), { status: 201 });
      }
      return new Response(
        JSON.stringify({ value: [{ name: "첨부", id: "F", file: {} }] }),
        { status: 200 },
      );
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    }) as any);
    expect(await ensureFolder("D", "VAULT", "첨부")).toBe("NEW");
  });

  it("조회가 실패하면 throw — 엉뚱한 자리에 올리지 않는다", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("nope", { status: 403 }),
    );
    await expect(ensureFolder("D", "VAULT", "첨부")).rejects.toThrow();
  });
});
