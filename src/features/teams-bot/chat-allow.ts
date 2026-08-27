/**
 * 어느 방에서 명보를 부를 수 있나.
 *
 * 처음에는 **한 방에서만** 연다(2026-08-27). 전 채팅방에 한꺼번에 풀면 실수로
 * 반응했을 때 여러 방이 한꺼번에 어지러워진다.
 *
 * **빈 값이면 전체가 아니라 아무 데도 아니다.** 설정을 빠뜨렸을 때 전 채팅방이
 * 열리는 쪽이 훨씬 나쁜 사고다 — 안 여는 쪽으로 기운다.
 */
export function allowedChats<T extends { id: string }>(
  chats: T[],
  allowList: string | undefined,
): T[] {
  const ids = new Set(
    (allowList ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
  );
  if (ids.size === 0) return [];
  return chats.filter((c) => ids.has(c.id));
}
