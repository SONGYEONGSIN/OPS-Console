// 학교별 제출 서류 업로드 알림 — 테이블 sms_sender_doc_upload_notices 한 행의 모양과
// 대조 결과를 저장소에 넘기는 갱신 단위들.

export type UploadState =
  | "seeded"
  | "skipped_self"
  | "pending"
  | "sending"
  | "sent"
  | "failed"
  | "dry_run";

export type ChangeKind = "new" | "replaced";

export type UploadRow = {
  item_id: string;
  name: string;
  folder_path: string;
  web_url: string | null;
  content_hash: string | null;
  change_kind: ChangeKind;
  state: UploadState;
  attempts: number;
  claimed_at: string | null;
};

export type UploadInsert = Omit<UploadRow, "claimed_at">;

/** 교체(PDF 의 해시가 바뀜) — 같은 행을 다시 알림 대기로 되돌린다. prevHash 가 맞을 때만. */
export type Rearm = {
  item_id: string;
  prevHash: string;
  name: string;
  folder_path: string;
  web_url: string | null;
  content_hash: string;
  change_kind: ChangeKind;
  state: "pending" | "skipped_self";
};

/** 저장 해시가 비어 있던 행에 해시를 채운다(알림 없음). */
export type HashFill = { item_id: string; content_hash: string };

/** PDF 가 아닌 파일의 해시 변경 — 알림 없이 해시만 바꾼다. prevHash 가 맞을 때만. */
export type HashUpdate = {
  item_id: string;
  prevHash: string;
  content_hash: string;
};

export type UploadRecovery = { item_id: string; state: "pending" | "failed" };
