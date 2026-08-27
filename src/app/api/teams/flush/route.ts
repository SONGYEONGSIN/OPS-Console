import { NextResponse, type NextRequest } from "next/server";
import { deliverPending } from "@/features/teams-bot/deliver";

/**
 * 답이 준비된 건을 Teams 로 내보낸다. cron 이 1분마다 부른다.
 *
 * 실제 일은 `deliverPending` 이 한다 — **poll 도 끝나면서 같은 함수를 부른다.**
 * 그래야 대기가 한 번으로 줄어 답이 빨라진다. 이 경로를 남기는 이유는 poll 이
 * 실패한 주기에도 밀린 답이 나가야 하기 때문이다.
 */
export async function POST(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  try {
    return NextResponse.json({ ok: true, ...(await deliverPending()) });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "실패" },
      { status: 500 },
    );
  }
}
