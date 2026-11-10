/**
 * 운영부 매뉴얼 원천 — `05. 매뉴얼` 폴더 + `00. 연간 운영부 업무 구성표` 의 두 시트.
 * 반기 점검 알림(manual-review)과 수정 알림이 같이 쓴다.
 */

/** `2. 매뉴얼 대장` 한 행. 셀 값은 trim 만 하고 가공하지 않는다. */
export type LedgerRow = {
  code: string | null;
  task: string;
  docName: string;
  /** 담당자 칸 원문 — 미확인 목록에 그대로 보여 준다. */
  ownerText: string;
  owners: string[];
  /** `최종 수정` 칸 값 그대로(날짜형이 아니라 문자열). 빈 칸이면 null. */
  lastModified: string | null;
};

/** 매뉴얼 폴더 바로 아래 파일 하나. cTag·수정 시각은 수정 알림이 바뀐 파일을 고를 때 쓴다. */
export type ManualFolderFile = {
  id: string;
  name: string;
  webUrl: string | null;
  lastModifiedDateTime: string | null;
  cTag: string | null;
};

export type ManualSource = {
  ledger: LedgerRow[];
  /** `1. 연간 일정` 의 '진행 중' 구역 업무 이름. */
  activeTasks: Set<string>;
  files: ManualFolderFile[];
};

export type OperatorEntry = { name: string; email: string; status: string };

export type ResolvedManual = LedgerRow & {
  /** 문서명과 파일명이 정확히 같은 파일. 없으면 '연결 안 됨'. */
  file: ManualFolderFile | null;
  /** 업무가 연간 일정 '진행 중' 구역에 있는가. */
  active: boolean;
  recipients: { name: string; email: string }[];
  /** 명부에서 못 찾은(또는 동명이인이라 고를 수 없는) 담당자 이름. */
  unresolvedOwners: string[];
};
