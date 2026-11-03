// 목록 필드 키. 구분 키 끝이 잘린 것은 오타가 아니라 SharePoint 내부 이름이다.
export const FIELD = {
  title: "Title",
  status: "_xc0c1__xd0dc_",
  university: "_xb300__xd559__xba85_",
  kind: "_xc0ac__xc774__xd2b8__xad6c__xbd",
  serviceId: "UnivID",
} as const;

export const STATUS_DONE = "완료";
export const MAX_ATTEMPTS = 3;
export const STALE_SENDING_MINUTES = 30;

export type NoticeKind = "new" | "done";
export type NoticeState =
  | "pending"
  | "sending"
  | "sent"
  | "dry_run"
  | "seeded"
  | "failed";

export type RequestItem = {
  id: string;
  status: string;
  university: string;
  kind: string;
  serviceId: string;
  title: string;
  applicantEmail: string | null;
  applicantName: string | null;
  webUrl: string | null;
};

export type NoticeRow = {
  item_id: string;
  last_status: string;
  new_state: NoticeState;
  new_attempts: number;
  new_claimed_at: string | null;
  done_state: NoticeState;
  done_attempts: number;
  done_claimed_at: string | null;
};

export type DueNotice = {
  kind: NoticeKind;
  item: RequestItem;
  attempts: number;
};

export type Recovery = {
  item_id: string;
  kind: NoticeKind;
  state: "pending" | "failed";
};
