// @vitest-environment node
//
// 이 라우트는 node 런타임에서 돈다. 기본 jsdom 으로 돌리면 jsdom 의 File 과
// undici 의 FormData 가 어긋나 `formData.set` 이 거절한다 — 실제 동작과 무관한 실패다.
import { describe, it, expect, vi, beforeEach } from "vitest";

const state = {
  me: { email: "song@jinhakapply.com", permission: "member" } as
    | { email: string; permission: string }
    | null,
  uploaded: null as { name: string; bytes: number } | null,
  throws: null as string | null,
};

vi.mock("@/features/auth/queries", () => ({
  getCurrentOperator: () => Promise.resolve(state.me),
}));

vi.mock("@/lib/microsoft/drive-upload", () => ({
  uploadLargeFileToFolder: (
    _drive: string,
    _folder: string,
    name: string,
    content: Buffer,
  ) => {
    if (state.throws) return Promise.reject(new Error(state.throws));
    state.uploaded = { name, bytes: content.length };
    return Promise.resolve({ itemId: "I", webUrl: `https://sp/${name}` });
  },
}));

const { POST } = await import("../route");

const post = (file?: File) => {
  const form = new FormData();
  if (file) form.set("file", file);
  return new Request("http://x/api/knowledge/upload", {
    method: "POST",
    body: form,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  }) as any;
};

const pdf = (name = "규정집.pdf", size = 10) =>
  new File([new Uint8Array(size)], name, { type: "application/pdf" });

/**
 * 올린 파일을 **링크로 바꿔 준다.** 읽는 길을 새로 내지 않고, 돌려준 주소를
 * 그대로 `read_file` 이 처리한다 — Teams 링크를 붙여넣었을 때와 같은 경로다.
 */
describe("지식망 파일 업로드", () => {
  beforeEach(() => {
    state.me = { email: "song@jinhakapply.com", permission: "member" };
    state.uploaded = null;
    state.throws = null;
    process.env.SHAREPOINT_DRIVE_ID = "DRIVE";
    process.env.SHAREPOINT_KNOWLEDGE_UPLOAD_ITEM_ID = "FOLDER";
  });

  it("올린 파일의 SharePoint 주소를 돌려준다", async () => {
    const res = await POST(post(pdf()));
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.webUrl).toContain("규정집.pdf");
  });

  it("올린 사람을 파일 이름에 남긴다 — 폴더에 남는 파일이다", async () => {
    await POST(post(pdf()));
    expect(state.uploaded?.name).toBe("song_규정집.pdf");
  });

  it("로그인 안 했으면 401", async () => {
    state.me = null;
    expect((await POST(post(pdf()))).status).toBe(401);
  });

  it("읽기 전용 권한은 403 — 남의 볼트에 파일을 못 올린다", async () => {
    state.me = { email: "a@b.com", permission: "viewer" };
    expect((await POST(post(pdf()))).status).toBe(403);
  });

  it("업로드 폴더 설정이 없으면 503 으로 그 사실을 알린다", async () => {
    // 조용히 실패하면 기능이 죽은 줄도 모르고 계속 쓴다.
    delete process.env.SHAREPOINT_KNOWLEDGE_UPLOAD_ITEM_ID;
    const res = await POST(post(pdf()));
    expect(res.status).toBe(503);
    expect((await res.json()).error).toContain(
      "SHAREPOINT_KNOWLEDGE_UPLOAD_ITEM_ID",
    );
  });

  it("파일이 없으면 400", async () => {
    expect((await POST(post())).status).toBe(400);
  });

  it("40MB 를 넘으면 거절한다 — read_file 이 받는 상한과 같다", async () => {
    // 41MB 를 실제로 multipart 로 실어 보내지 않는다. size 만 큰 File 을
    // 라우트에 바로 건네 **가드가 도는지**를 본다(undici 재직렬화를 거치면
    // 덮어쓴 size 가 사라진다).
    class BigFile extends File {
      get size() {
        return 41 * 1024 * 1024;
      }
    }
    const big = new BigFile([new Uint8Array(2)], "큰.pdf", {
      type: "application/pdf",
    });
    const req = {
      formData: () => Promise.resolve({ get: () => big }),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any;
    expect((await POST(req)).status).toBe(413);
  });

  it("PDF 로 못 바꾸는 형식은 거절하고 어디로 가야 하는지 알려준다", async () => {
    const res = await POST(post(pdf("메모.txt")));
    expect(res.status).toBe(415);
    expect((await res.json()).error).toContain("직접 입력");
  });

  it("업로드가 실패하면 사유를 돌려준다 — 빈 링크를 주지 않는다", async () => {
    state.throws = "createUploadSession 403";
    const res = await POST(post(pdf()));
    expect(res.status).toBe(502);
    expect((await res.json()).error).toContain("403");
  });
});
