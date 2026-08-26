import "server-only";
import { getGraphToken } from "@/lib/microsoft/auth";

/**
 * Entra 객체 id → 메일 주소.
 *
 * **Teams 는 이메일을 주지 않는다.** Activity 의 `from.aadObjectId` 로 오므로,
 * 운영자 명부(`operators.email`)와 대조하려면 한 번 바꿔야 한다.
 *
 * 실패하면 `null` 이다 — 못 찾은 것을 아무 주소로 메우면 남의 이름으로 내부 기록을
 * 읽게 된다. 던지지도 않는다: 채팅 한 건 때문에 라우트가 500 이 되면 그 방의 다른
 * 질문까지 막힌다.
 */
export async function emailFromAadObjectId(
  aadObjectId: string,
): Promise<string | null> {
  try {
    const token = await getGraphToken();
    // id 를 그대로 붙이지 않는다 — 경로 조각이 섞여 오면 다른 자원을 가리킬 수 있다.
    const id = encodeURIComponent(aadObjectId);
    const res = await fetch(
      `https://graph.microsoft.com/v1.0/users/${id}?$select=mail,userPrincipalName`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    if (!res.ok) return null;
    const u = (await res.json()) as { mail?: string | null; userPrincipalName?: string | null };
    // 메일함이 없는 계정은 mail 이 비어 있다 — UPN 이 곧 주소다.
    return u.mail || u.userPrincipalName || null;
  } catch {
    return null;
  }
}
