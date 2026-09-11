/**
 * 워크북 열람 창구 등록부 — key → 어느 파일을, 누가 열 수 있나.
 *
 * 버튼이 링크 조회에 매달리지 않게 라우트로 뺐다(총괄장 #1174~#1176 과 같은 이유).
 * 전에는 페이지가 먼저 조회해 성공했을 때만 버튼을 그려서, 조회가 실패하면
 * 사용자에게 '기능이 없는 것'과 구분되지 않았다.
 *
 * **라우트가 하나라 URL 이 추측 가능해진다.** 그래서 권한이 여기 한 줄에 적혀
 * 있고 `adminOnly` 는 선택 필드가 아니다 — 고를 수 있으면 언젠가 빠진다(#1049).
 *
 * env 는 **이름만** 담는다. 값을 담으면 502 에 찍을 이름을 또 저장해야 하고,
 * 둘이 어긋나면 A 를 읽으면서 B 를 말하는 문구가 나온다.
 */
export type WorkbookEntry = {
  /** requireMenu 슬러그. 사이드바에 실재해야 한다 — 오타는 조용히 통과한다. */
  menu: string;
  /** 버튼 이름이자 502 본문에 그대로 나가는 이름. */
  label: string;
  driveEnv: string;
  itemEnv: string;
  /** 선택 필드가 아니다. 빠뜨리면 컴파일이 안 된다. */
  adminOnly: boolean;
};

export const WORKBOOKS = {
  "contracts-ledger": {
    menu: "contracts",
    label: "계약관리대장",
    driveEnv: "SHAREPOINT_DRIVE_ID",
    itemEnv: "SHAREPOINT_CONTRACTS_ITEM_ID",
    adminOnly: false,
  },
  // 미수채권 두 대장은 메인이 아니라 전용 드라이브에 있다(같은 파일의 다른 아이템).
  "receivables-ledger": {
    menu: "receivables",
    label: "미수채권대장",
    driveEnv: "SHAREPOINT_RECEIVABLES_DRIVE_ID",
    itemEnv: "SHAREPOINT_RECEIVABLES_ITEM_ID",
    adminOnly: false,
  },
  // 화면에서도 admin 에게만 그리지만, 그건 '보이느냐'일 뿐이다. 주소를 직접
  // 치면 열리므로 서버가 막아야 한다 — 이 변경 전에는 서버 강제가 없었다.
  "receivables-deposit": {
    menu: "receivables",
    label: "수수료입금내역",
    driveEnv: "SHAREPOINT_RECEIVABLES_DRIVE_ID",
    itemEnv: "SHAREPOINT_DEPOSIT_ITEM_ID",
    adminOnly: true,
  },
  "postal-ledger": {
    menu: "postal",
    label: "등기대장",
    driveEnv: "SHAREPOINT_DRIVE_ID",
    itemEnv: "SHAREPOINT_MAIL_ITEM_ID",
    adminOnly: false,
  },
  "postal-petty-cash": {
    menu: "postal",
    label: "전도금대장",
    driveEnv: "SHAREPOINT_DRIVE_ID",
    itemEnv: "SHAREPOINT_PETTY_CASH_ITEM_ID",
    adminOnly: false,
  },
  "incidents-gongmun": {
    menu: "incidents",
    label: "공문관리대장",
    driveEnv: "SHAREPOINT_DRIVE_ID",
    itemEnv: "SHAREPOINT_GONGMUN_ITEM_ID",
    adminOnly: false,
  },
} as const satisfies Record<string, WorkbookEntry>;

export type WorkbookKey = keyof typeof WORKBOOKS;

export function getWorkbookEntry(key: string): WorkbookEntry | undefined {
  return (WORKBOOKS as Record<string, WorkbookEntry>)[key];
}
