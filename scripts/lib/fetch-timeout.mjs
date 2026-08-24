/**
 * 이벤트 루프를 잡는 타임아웃.
 *
 * `AbortSignal.timeout()` 을 쓰면 안 된다 — **그 타이머는 unref 되어 있다.**
 * 3초짜리를 만들어도 프로세스를 0ms 만 잡는다(실측).
 *
 * 2026-08-24 09:54 회사 PC 가 절전에 들어갔다. 진행 중이던 fetch 가 좀비가 됐고,
 * 깨울 타이머가 루프를 안 잡고 있어 **이벤트 루프가 통째로 비었다.** Node 는
 * top-level await 가 pending 인 채 종료했고(exit 13) 어시스턴트가 1시간 멈췄다.
 *
 * `setTimeout` 은 ref 되므로 루프를 잡는다. 깨어난 뒤 발화해 abort → reject →
 * 폴러의 catch 로 이어져 다음 주기에 다시 시도한다.
 */

/**
 * 타임아웃 신호를 만든다. 일이 끝나면 **반드시 `done()`** 을 불러 타이머를 치운다 —
 * 안 치우면 프로세스가 그만큼 안 죽는다.
 */
export function withTimeout(ms) {
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), ms);
  return { signal: ac.signal, done: () => clearTimeout(timer) };
}

/** 타임아웃이 붙은 fetch. 성공·실패 어느 쪽이든 타이머를 치운다. */
export async function fetchWithTimeout(url, init = {}, ms) {
  const { signal, done } = withTimeout(ms);
  try {
    return await fetch(url, { ...init, signal });
  } finally {
    done();
  }
}
