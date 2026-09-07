import { kstFormat } from "@/lib/kst-format";

const DAY = kstFormat({ month: "numeric", day: "numeric" });

/**
 * `9/7` — 막대 밑에 일곱 개가 나란히 서므로 짧아야 한다.
 *
 * `kstFormat` 을 거치는 이유는 **한국 시각 기준 날짜**를 얻기 위해서다.
 * `Date#getMonth()` 를 쓰면 브라우저 시간대를 타서 자정 근처에 하루가 밀린다.
 * ko-KR 이 주는 `9. 7.` 은 자리를 너무 먹어 조각에서 다시 조립한다.
 */
function dayLabel(d: Date): string {
  const parts = DAY.formatToParts(d);
  const at = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return `${at("month")}/${at("day")}`;
}

/**
 * 막대에 붙일 날짜 — `daily` 는 오름차순이라 **마지막 칸이 오늘**이다.
 *
 * 숫자만 늘어놓으면 어느 날 것인지 알 수 없다. `최근 7일 · 0 · 0 · 1 · 1 · 0 · 0 · 3`
 * 이 무엇인지 읽히지 않았다(2026-09-07 지적).
 */
export function usageDayLabels(
  count: number,
  today: Date = new Date(),
): string[] {
  return Array.from({ length: count }, (_, i) => {
    const d = new Date(today);
    d.setDate(d.getDate() - (count - 1 - i));
    return dayLabel(d);
  });
}

/**
 * 일별 실행 건수 막대 — **화면 너비를 채운다.**
 *
 * 전에는 유니코드 블록 문자(`▁▃█`)를 글자로 찍어서, 폭이 글꼴에 묶이고
 * 인스펙터가 넓어져도 한 줌으로 남았다. 값·날짜·단위가 따로 흩어져 있어
 * 무엇을 보는지도 알기 어려웠다.
 *
 * 막대 높이는 **이 에이전트 자기 최대값 기준**이라 다른 에이전트와 견주면 틀린다.
 * 그래서 최대값을 글로 함께 적는다.
 */
export function UsageChart({
  daily,
  today,
}: {
  /** 일별 건수(오름차순, 마지막이 오늘). */
  daily: number[];
  /** 테스트에서 고정하기 위한 기준일. */
  today?: Date;
}) {
  const labels = usageDayLabels(daily.length, today);
  const max = Math.max(...daily);
  const total = daily.reduce((n, v) => n + v, 0);

  return (
    <div className="w-full">
      {/*
        **칸이 줄의 높이를 물려받아야 막대의 `%` 가 풀린다.**

        처음엔 줄에 `items-end` 를 줬는데, 그러면 각 칸의 높이가 `auto` 라
        자식의 `height: 50%` 가 기준을 잃고 0 이 된다 — 숫자와 날짜만 남고
        막대가 통째로 안 보였다(2026-09-07).

        그래서 늘림(기본 stretch)으로 두고, 막대가 놓일 자리를 `relative flex-1`
        로 만들어 그 안에 바닥부터 세운다.
      */}
      <div data-usage-row className="flex h-24 gap-1">
        {daily.map((n, i) => (
          <div
            key={i}
            data-usage-bar
            title={`${labels[i]} · ${n}건`}
            className="flex flex-1 flex-col gap-1"
          >
            <span className="text-center text-2xs tabular-nums text-muted">
              {n}
            </span>
            <div data-usage-track className="relative flex-1">
              {/* 0 인 날도 바닥선을 남긴다 — '없음'과 '안 잼'은 다르다. */}
              <div
                aria-hidden
                data-usage-fill
                style={{
                  height: max > 0 && n > 0 ? `${(n / max) * 100}%` : "2%",
                }}
                className={`absolute bottom-0 left-0 w-full ${
                  n > 0 ? "bg-vermilion" : "bg-line-soft"
                }`}
              />
            </div>
          </div>
        ))}
      </div>
      <div className="mt-1 flex gap-1 border-t border-line-soft pt-1">
        {labels.map((l, i) => (
          <span
            key={i}
            className="flex-1 text-center text-2xs tabular-nums text-muted"
          >
            {l}
          </span>
        ))}
      </div>
      <p className="mt-2 text-xs text-ink-soft">
        <span className="tabular-nums">{`최근 ${daily.length}일 실행 건수 — 합계 ${total}건`}</span>
      </p>
      <p className="mt-0.5 text-2xs text-muted">
        {total === 0
          ? "이 기간에 실행이 없습니다."
          : `하루 최대 ${max}건 — 막대 높이는 이 값 기준이라 다른 에이전트와 견주지 마세요.`}
      </p>
    </div>
  );
}
