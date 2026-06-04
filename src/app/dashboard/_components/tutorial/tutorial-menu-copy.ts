// 메뉴(slug)별 튜토리얼 콘텐츠 사전 — 단일 소스.
// 각 메뉴는 ①개요(overview) ②리스트→인스펙터 인터랙션 안내(interaction)
// ③핵심 버튼 기능 설명(buttons[])을 가진다.
// 사전에 없는 slug는 빌더가 스텝을 생성하지 않는다(폴백 금지 — donts.md).
// 콘텐츠는 메뉴 batch 단위로 점진 확장한다.

export type MenuButtonCopy = {
  /** 버튼/액션 라벨 (화면 표기와 일치) */
  label: string;
  /** 그 버튼이 하는 일 설명 */
  desc: string;
};

export type MenuCopy = {
  /** 이 메뉴가 무엇을 위한 곳인지 */
  overview: string;
  /** "리스트 행을 클릭하면 오른쪽 인스펙터가 열린다" 류의 상호작용 안내 */
  interaction: string;
  /** 이 메뉴의 핵심 버튼 기능 설명 (없으면 빈 배열) */
  buttons: MenuButtonCopy[];
};

/**
 * 콘텐츠 무결성 — overview/interaction이 비어있지 않고,
 * 등록된 버튼은 label·desc가 모두 채워졌는지. (빈 문구 가드)
 */
export function isMenuCopyComplete(copy: MenuCopy): boolean {
  if (copy.overview.trim().length === 0) return false;
  if (copy.interaction.trim().length === 0) return false;
  return copy.buttons.every(
    (b) => b.label.trim().length > 0 && b.desc.trim().length > 0,
  );
}

export const MENU_COPY: Record<string, MenuCopy> = {
  // 시드 — 인프라 검증용. 실제 전체 메뉴 콘텐츠는 후속 batch(T9~)에서 채운다.
  "my-todo": {
    overview:
      "작성 시작일(write_start_at)이 60일 이내인 담당 작업을 모아 보여주는 개인 플래너입니다. 좌측은 읽기 전용 작업 목록, 우측 인스펙터에 할 일을 누적합니다.",
    interaction:
      "좌측 목록의 작업 행을 우측 인스펙터로 끌어다 놓으면 할 일로 담깁니다. 끌어놓기 외에 ‘+ 담기’ 버튼이나 더블클릭으로도 추가할 수 있습니다.",
    buttons: [
      {
        label: "+ 담기",
        desc: "좌측에서 선택한 작업을 우측 ‘할 일’ 목록에 추가합니다.",
      },
      {
        label: "체크박스",
        desc: "할 일을 완료 처리합니다. 완료하면 좌측 원본 행이 음영·취소선으로 표시됩니다.",
      },
    ],
  },
};
