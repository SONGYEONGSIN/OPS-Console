import { NextResponse } from "next/server";
import { requireMenu } from "@/features/auth/menu-guard";
import { getWorkbookEntry } from "@/features/workbook/registry";
import { resolveWorkbookUrl } from "@/features/workbook/resolve";

const TEXT = {
  "content-type": "text/plain; charset=utf-8",
  "cache-control": "no-store",
} as const;

/**
 * 워크북 원본 파일로 보내는 창구.
 *
 * **버튼이 링크 조회에 매달리지 않게 하려고 둔다.** 전에는 페이지가 먼저 조회해
 * 성공했을 때만 버튼을 그렸다. 조회가 실패하면 버튼이 아예 없었고 사용자에게는
 * '기능이 안 만들어진 것'과 구분되지 않았다 — 총괄장에서 실제로 그렇게
 * 보고받았고 원인을 찾는 데 한참 걸렸다(2026-09-09). 나머지 6버튼에도 같은
 * 함정이 남아 있어 여기로 모은다.
 *
 * 이제 버튼은 늘 있고 여기서 푼다. 못 풀면 **이유가 화면에 뜬다.**
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ key: string }> },
): Promise<Response> {
  const { key } = await params;

  // **메뉴 가드보다 먼저** 본다. 모르는 키로 가드를 돌리면 엉뚱한 메뉴로
  // 리다이렉트돼, 없는 대장을 열려 한 사람이 대시보드에 떨어진다.
  const entry = getWorkbookEntry(key);
  if (!entry) {
    return new NextResponse(`그런 대장이 없습니다: ${key}`, {
      status: 404,
      headers: TEXT,
    });
  }

  const me = await requireMenu(entry.menu);

  // 이 변경 전까지 admin 제한은 **렌더 게이팅뿐**이었다 — admin 에게만 버튼이
  // 그려져 안전했을 뿐 서버 강제가 없었다. 주소가 추측 가능해졌으니 여기서 막는다.
  //
  // requireAdmin() 을 쓰지 않는다: 그건 /dashboard 로 redirect 하는데 버튼이
  // target="_blank" 라 **새 탭에 대시보드가 뜬다** — '아무 일도 안 일어남'이 되어
  // 이 PR 이 고치려는 증상과 똑같은 모양이 된다.
  if (entry.adminOnly && me.permission !== "admin") {
    return new NextResponse(
      `${entry.label}은 관리자만 열 수 있습니다.`,
      { status: 403, headers: TEXT },
    );
  }

  const url = await resolveWorkbookUrl(entry);
  if (!url) {
    // 이유 없이 실패만 알리면 담당자가 손쓸 수 없다 — 확인할 env 이름을 적는다.
    return new NextResponse(
      [
        `${entry.label} 원본 파일 주소를 가져오지 못했습니다.`,
        "",
        `${entry.driveEnv} / ${entry.itemEnv} 설정과`,
        "Graph 접근 권한을 확인해야 합니다. 담당자에게 이 화면을 알려주세요.",
      ].join("\n"),
      { status: 502, headers: TEXT },
    );
  }

  // 링크는 SharePoint 쪽 사정으로 바뀔 수 있다 — 캐시하지 않는다.
  return NextResponse.redirect(url, {
    headers: { "cache-control": "no-store" },
  });
}
