/**
 * 같은 목록(`closing_services`)을 두 메뉴가 나눠 본다.
 *
 * - **배포 · 운영**(`open`) — 아직 마감 전. 지금 운영해야 할 대상이다.
 * - **서비스마감**(`closed`) — 마감이 지난 것. 정산·회고 대상이다.
 *
 * 전에는 한 화면에 섞어 두고 `진행중` 칩으로 갈랐다. 메뉴로 가르고 나면 **각 메뉴
 * 안에서 마감여부를 다시 고를 이유가 없다** — 그래서 진행중 칩을 없애고, '전체'는
 * 그 메뉴가 맡은 범위의 전체를 뜻한다.
 *
 * 범위를 칩이 못 바꾸게 막는 게 이 함수의 요점이다. 마감 메뉴에서 진행중이 나오면
 * 메뉴를 가른 의미가 사라진다.
 */

/**
 * 메뉴가 맡은 범위.
 *
 * `settlement` 은 목록 자체는 `closed` 와 같다 — 결제가 끝난 것. 다만 화면이
 * 정산기한을 붙여 다르게 보여주므로 칩 이름이 다르다.
 */
export type ClosingScope = "open" | "closed" | "settlement";

export type ScopeFilter = {
  /** listClosing 이 받는 값 — scope 를 그대로 넘기지 않는다(settlement 는 closed 다). */
  closedStatus: "open" | "closed";
  /** 본인 담당만 볼 때의 이름. 전체면 undefined. */
  operatorName: string | undefined;
};

export function resolveScopeFilter(
  scope: ClosingScope,
  chip: string,
  myName: string | null | undefined,
): ScopeFilter {
  return {
    // 칩이 무엇이든 범위는 메뉴가 정한다. 정산은 결제가 끝난 것을 본다.
    closedStatus: scope === "open" ? "open" : "closed",
    // 기본은 '내 것' — 처음 열었을 때 남의 서비스가 잔뜩 나오면 쓸모가 없다.
    // 이름을 모르면 빈 문자열로 둔다(아무것도 안 걸림) — 남의 것을 보여주는 것보다 낫다.
    operatorName: chip === "all" ? undefined : (myName ?? ""),
  };
}

export type ChipOption = { key: "all" | "mine"; label: string };

const MINE_LABEL: Record<ClosingScope, string> = {
  // 마감한 게 아니라 맡고 있는 것이라, 배포·운영에서는 '내 서비스'다.
  open: "내 서비스",
  closed: "내 마감",
  settlement: "내 정산",
};

export function chipOptions(scope: ClosingScope): ChipOption[] {
  return [
    { key: "all", label: "전체" },
    { key: "mine", label: MINE_LABEL[scope] },
  ];
}
