import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getGraphToken } from "@/lib/microsoft/auth";
import { toSharingToken } from "@/lib/microsoft/sharing-token";

/**
 * 어시스턴트 도구 — SharePoint·Teams 파일을 읽을 수 있게 내려준다.
 *
 * 볼트는 마크다운이라 폴러가 그냥 `Read` 하면 되지만, Teams 에 올라온 파일은
 * Word·PPT·Excel·PDF 다. **Graph 가 PDF 로 변환해 준다**(`/content?format=pdf`) —
 * 셋이 한 형식으로 모이고, PDF 는 모델이 그대로 읽는다. 원본이 이미 PDF 면 변환을
 * 건너뛴다(아래).
 *
 * 파일을 여기서 통째로 실어 보내지 않는다. Graph 가 주는 **짧게 사는 임시 주소**만
 * 넘기고 내려받기는 폴러가 한다 — 우편물 영수증과 같은 구조다.
 *
 * 링크 해석은 Graph 에 맡긴다(`sharing-token.ts`). 채널 파일·채팅 파일·공유 링크가
 * 모양이 제각각이라, 우리가 파싱하면 새 형태마다 깨진다.
 */

const GRAPH = "https://graph.microsoft.com/v1.0";

/**
 * 이보다 크면 거절한다.
 *
 * 통째로 읽히면 답이 흐려지고 오래 걸린다. 큰 문서는 사람이 필요한 장을 잘라
 * 올리는 편이 낫다.
 */
const MAX_BYTES = 40 * 1024 * 1024;

const bodySchema = z.object({ url: z.string().trim().min(1) });

export async function POST(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "url이 필요합니다" }, { status: 400 });
  }

  let token: string;
  try {
    token = toSharingToken(parsed.data.url);
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "링크를 읽을 수 없습니다" },
      { status: 400 },
    );
  }

  const graph = await getGraphToken();
  const auth = { Authorization: `Bearer ${graph}` };

  const meta = await fetch(
    `${GRAPH}/shares/${token}/driveItem?$select=name,size,file,webUrl`,
    { headers: auth },
  );
  if (!meta.ok) {
    // 권한이 없어도 404 로 온다 — 둘을 구분해 알려줄 수단이 없다.
    return NextResponse.json(
      { ok: false, error: "파일을 찾을 수 없습니다 (링크·권한을 확인하세요)" },
      { status: 404 },
    );
  }

  const item = (await meta.json()) as {
    name: string;
    size?: number;
    file?: { mimeType?: string };
    webUrl?: string;
  };

  if ((item.size ?? 0) > MAX_BYTES) {
    return NextResponse.json(
      {
        ok: false,
        error: `파일이 큽니다 (${Math.round((item.size ?? 0) / 1024 / 1024)}MB). 필요한 부분만 잘라 올려주세요.`,
      },
      { status: 413 },
    );
  }

  // 이미 PDF 면 변환을 부탁하지 않는다 — 변환 서비스는 **PDF 를 입력으로 받지 않는다**.
  // 거절이 302 다음에 온다: `?format=pdf` 는 임시 주소를 멀쩡히 내주고, 그 주소를 열면
  // 406 `InputFormatNotSupported` 다. 여기서 성공으로 보이고 폴러에서 "내려받기 406" 으로
  // 죽었다(2026-08-24 규정집 PDF). 원본을 그대로 준다 — 어차피 우리가 원하는 형식이다.
  const isPdf = item.file?.mimeType === "application/pdf";

  // 변환도 원본도 302 로 임시 주소를 준다. 그 주소는 인증이 필요 없고 곧 만료된다.
  const content = await fetch(
    `${GRAPH}/shares/${token}/driveItem/content${isPdf ? "" : "?format=pdf"}`,
    { headers: auth, redirect: "manual" },
  );
  const downloadUrl = content.headers.get("location");
  if (!downloadUrl) {
    // 조용히 빈 값을 주지 않는다 — 모델이 빈 파일을 읽고 지어내면 더 나쁘다.
    return NextResponse.json(
      {
        ok: false,
        error: isPdf
          ? "파일을 내려받을 주소를 못 받았습니다"
          : "이 형식은 PDF로 바꿀 수 없습니다",
      },
      { status: 502 },
    );
  }

  return NextResponse.json({
    ok: true,
    name: item.name,
    size: item.size ?? null,
    mimeType: item.file?.mimeType ?? null,
    webUrl: item.webUrl ?? parsed.data.url,
    downloadUrl,
  });
}
