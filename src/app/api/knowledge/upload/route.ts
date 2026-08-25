import { NextResponse, type NextRequest } from "next/server";
import { getCurrentOperator } from "@/features/auth/queries";
import {
  ensureFolder,
  uploadLargeFileToFolder,
} from "@/lib/microsoft/drive-upload";

/**
 * 내 PC 의 파일로 지식망 초안 만들기 — 올려서 **링크로 바꿔 준다.**
 *
 * 읽는 길을 새로 내지 않는다. 올린 파일의 SharePoint 주소를 돌려주면 그 뒤는
 * Teams 링크를 붙여넣었을 때와 똑같이 `read_file` 이 처리한다. 우리가 하는 일은
 * **사용자 대신 링크를 만들어 주는 것**뿐이다.
 *
 * 파일은 **볼트 밑 `첨부/` 에 둔다.** 올릴 자리를 사람이 찾아 env 에 넣게 하면
 * 안 넣은 채로 기능이 죽는다 — 볼트 위치는 인덱서가 이미 알고 있으므로 그 밑에
 * 필요할 때 폴더를 만든다. 인덱서는 `.md` 만 인덱싱하고 `첨부` 는 아예 건너뛴다.
 *
 * 볼트에 두는 게 맞는 이유: 초안의 근거가 된 원본을 나중에 아무도 못 찾으면 그
 * 지식은 확인할 수 없는 지식이 된다. 옵시디언에서 초안을 검토하는 사람이 바로
 * 옆에서 원본을 열 수 있어야 한다.
 */

/** 원본 파일을 두는 볼트 안 폴더. `index-vault.ts` 의 SKIP_DIRS 와 같아야 한다. */
const ATTACH_DIR = "첨부";

/** `read_file` 이 받아 주는 상한과 맞춘다 — 여기서 통과하고 저기서 막히면 헛수고다. */
const MAX_BYTES = 40 * 1024 * 1024;

/**
 * PDF 로 바꿀 수 있는 것만 받는다(Graph 변환 입력 형식).
 *
 * 텍스트·마크다운은 여기 없다 — 그건 '직접 입력' 칸이 더 빠르고, 변환 서비스도
 * 안 받는다. PDF 는 변환 없이 그대로 읽힌다.
 */
const ALLOWED_EXT = new Set([
  "pdf",
  "doc",
  "docx",
  "ppt",
  "pptx",
  "xls",
  "xlsx",
  "rtf",
  "odt",
  "ods",
  "odp",
  "csv",
]);

export async function POST(request: NextRequest) {
  const me = await getCurrentOperator();
  if (!me) {
    return NextResponse.json(
      { ok: false, error: "로그인이 필요합니다" },
      { status: 401 },
    );
  }
  if (me.permission === "viewer") {
    return NextResponse.json(
      { ok: false, error: "읽기 전용 권한입니다" },
      { status: 403 },
    );
  }

  const driveId = process.env.SHAREPOINT_DRIVE_ID;
  const vaultId = process.env.SHAREPOINT_KNOWLEDGE_FOLDER_ID;
  if (!driveId || !vaultId) {
    // 설정이 빠졌다는 걸 화면에 그대로 알린다 — 조용히 실패하면 기능이 죽은
    // 줄도 모르고 계속 쓴다(오픈안내 cron 등록 누락과 같은 사각지대).
    return NextResponse.json(
      {
        ok: false,
        error:
          "볼트 위치가 설정되지 않았습니다 (SHAREPOINT_DRIVE_ID / SHAREPOINT_KNOWLEDGE_FOLDER_ID). 링크 붙여넣기를 써 주세요.",
      },
      { status: 503 },
    );
  }

  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json(
      { ok: false, error: "파일이 없습니다" },
      { status: 400 },
    );
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      {
        ok: false,
        error: `파일이 큽니다 (${Math.round(file.size / 1024 / 1024)}MB). 40MB 이하만 됩니다.`,
      },
      { status: 413 },
    );
  }

  const ext = (file.name.split(".").pop() ?? "").toLowerCase();
  if (!ALLOWED_EXT.has(ext)) {
    return NextResponse.json(
      {
        ok: false,
        error: `${ext || "이 형식"}은 읽을 수 없습니다. Word·PPT·Excel·PDF 를 올리거나 '직접 입력'을 쓰세요.`,
      },
      { status: 415 },
    );
  }

  // 누가 언제 올렸는지 파일 이름에 남긴다 — 폴더에 남는 파일이라 나중에
  // 무엇인지 알아볼 수 있어야 하고, 같은 이름끼리 뒤섞이지 않는다.
  const stamped = `${me.email.split("@")[0]}_${file.name}`;

  try {
    const attachId = await ensureFolder(driveId, vaultId, ATTACH_DIR);
    const { webUrl } = await uploadLargeFileToFolder(
      driveId,
      attachId,
      stamped,
      Buffer.from(await file.arrayBuffer()),
    );
    return NextResponse.json({ ok: true, webUrl, name: file.name });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "업로드 실패" },
      { status: 502 },
    );
  }
}
