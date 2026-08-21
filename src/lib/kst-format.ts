/**
 * 화면에 찍는 날짜·시각 포맷터.
 *
 * **불변식 둘을 여기서만 정한다** — 한국 시각(`Asia/Seoul`), 24시간제.
 *
 * 전에는 32곳이 각자 `timeZone` 과 `hour12: false` 를 적었다. 그러다 두 곳이
 * `hour12` 를 빠뜨렸고, `Intl` 의 ko-KR 기본값이 12시간제라 같은 표 안에서
 * `오후 04:48` 과 `15:44` 가 섞였다(2026-08-22 우편물). **기억해야 지켜지는
 * 규칙은 언젠가 안 지켜진다.**
 *
 * 나머지 옵션(연·월·일·요일·시·분)은 자리마다 다르므로 부르는 쪽이 정한다.
 * 시각을 안 쓰면 시각은 안 나오니 날짜만 쓰는 곳도 그대로 쓸 수 있다.
 */

/** 불변식은 넘길 수 없다 — 타입에서 뺀다. */
export type KstFormatOptions = Omit<
  Intl.DateTimeFormatOptions,
  "timeZone" | "hour12" | "hourCycle"
>;

export function kstFormat(options: KstFormatOptions): Intl.DateTimeFormat {
  return new Intl.DateTimeFormat("ko-KR", {
    ...options,
    // 스프레드 뒤에 둔다 — 앞에 두면 옵션이 덮어쓸 수 있다.
    timeZone: "Asia/Seoul",
    hour12: false,
  });
}
