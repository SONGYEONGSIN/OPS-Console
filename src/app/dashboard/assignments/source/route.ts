import { NextResponse } from "next/server";
import { requireMenu } from "@/features/auth/menu-guard";
import { getAssignmentsWorkbookUrl } from "@/features/assignments/workbook-link";

/**
 * 총괄장 원본 파일로 보내는 창구.
 *
 * **버튼이 링크 조회에 매달리지 않게 하려고 둔다.** 전에는 페이지가 먼저 조회해
 * 성공했을 때만 버튼을 그렸다. 그래서 조회가 실패하면 버튼이 아예 없었고,
 * 사용자에게는 '기능이 안 만들어진 것'과 구분되지 않았다 — 실제로 그렇게
 * 보고받았고 원인을 찾는 데 한참 걸렸다(2026-09-09).
 *
 * 이제 버튼은 늘 있고 여기서 푼다. 못 풀면 **이유가 화면에 뜬다.**
 * 덤으로 페이지 렌더가 Graph 왕복을 기다리지 않는다.
 */
export async function GET(): Promise<Response> {
  await requireMenu("assignments");

  const url = await getAssignmentsWorkbookUrl();
  if (!url) {
    return new NextResponse(
      [
        "총괄장 원본 파일 주소를 가져오지 못했습니다.",
        "",
        "SHAREPOINT_DRIVE_ID / SHAREPOINT_ASSIGNMENTS_ITEM_ID 설정과",
        "Graph 접근 권한을 확인해야 합니다. 담당자에게 이 화면을 알려주세요.",
      ].join("\n"),
      {
        status: 502,
        headers: {
          "content-type": "text/plain; charset=utf-8",
          "cache-control": "no-store",
        },
      },
    );
  }

  // 링크는 SharePoint 쪽 사정으로 바뀔 수 있다 — 캐시하지 않는다.
  return NextResponse.redirect(url, {
    headers: { "cache-control": "no-store" },
  });
}
