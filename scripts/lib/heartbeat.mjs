import { hostname } from "node:os";

/**
 * 폴러가 "살아있음"을 서버에 남긴다.
 *
 * 큐 기록만으로는 **요청이 없을 때** 조용한 폴러와 죽은 폴러를 구분할 수 없다.
 * 2026-08-20 밤 어시스턴트 폴러가 죽었는데 20:49 질문이 12시간 뒤에야 답을 받았고,
 * 그 사이 설정 화면은 'unknown'만 보여줬다.
 *
 * **실패해도 폴러는 신경 쓰지 않는다** — 심박 때문에 일이 멈추면 주객이 뒤바뀐다.
 * 다만 조용히 넘기지는 않는다. 심박이 통째로 죽어 있으면 화면이 폴러를 죽은 것으로
 * 보고하는데, 그 오해가 계속되면 화면을 안 믿게 된다.
 */
const BEAT_MS = 60_000;

export function startHeartbeat({ baseUrl, secret, pollerId, log = console.error }) {
  if (!baseUrl || !secret) return () => {};

  let warned = false;
  const beat = async () => {
    try {
      const res = await fetch(`${baseUrl}/api/pollers/heartbeat`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${secret}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({ pollerId, machine: hostname() }),
        signal: AbortSignal.timeout(10_000),
      });
      if (!res.ok && !warned) {
        warned = true;
        log(`[heartbeat] ${pollerId} 실패 ${res.status} — 화면이 멈춘 것으로 볼 수 있습니다`);
      }
      if (res.ok) warned = false;
    } catch (e) {
      if (!warned) {
        warned = true;
        log(`[heartbeat] ${pollerId} 실패: ${e.message}`);
      }
    }
  };

  void beat();
  const timer = setInterval(beat, BEAT_MS);
  // 프로세스가 이것 때문에 살아 있지는 않게 한다.
  timer.unref?.();
  return () => clearInterval(timer);
}
