import "server-only";
import { getGraphToken } from "@/lib/microsoft/auth";
import { fetchWorkbookWebUrl } from "@/lib/microsoft/workbook-web-url";
import type { WorkbookEntry } from "./registry";

/**
 * 등록부가 적어 둔 env **이름**으로 값을 읽어 webUrl 을 푼다.
 *
 * 못 풀면 null 이다. 호출부(라우트)가 그걸 502 로 바꿔 **이유를 화면에 보여준다** —
 * 버튼을 지우지 않는다. 버튼이 사라지면 '기능이 없는 것'과 구분되지 않는다.
 */
export async function resolveWorkbookUrl(
  entry: WorkbookEntry,
): Promise<string | null> {
  const driveId = process.env[entry.driveEnv];
  const itemId = process.env[entry.itemEnv];
  // 값이 없는데 Graph 를 부르면 헛왕복이고 실패 이유도 흐려진다.
  if (!driveId || !itemId) {
    console.error(
      `[workbook] ${entry.label} — ${entry.driveEnv}/${entry.itemEnv} 미설정`,
    );
    return null;
  }

  let token: string;
  try {
    token = await getGraphToken();
  } catch (e) {
    console.error(`[workbook] ${entry.label} — Graph 토큰 획득 실패:`, e);
    return null;
  }
  return fetchWorkbookWebUrl(token, driveId, itemId, entry.label);
}
