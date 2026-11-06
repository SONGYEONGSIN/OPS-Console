import { MAX_ATTEMPTS, STALE_SENDING_MINUTES } from "../request-notify/types";
import type { RawDocFile } from "../types";
import type {
  ChangeKind,
  HashFill,
  HashUpdate,
  Rearm,
  UploadInsert,
  UploadRecovery,
  UploadRow,
} from "./types";

export type DueUpload = {
  file: RawDocFile;
  kind: ChangeKind;
  attempts: number;
};

export type UploadPlan = {
  inserts: UploadInsert[];
  rearms: Rearm[];
  fills: HashFill[];
  hashUpdates: HashUpdate[];
  recoveries: UploadRecovery[];
  due: DueUpload[];
  skippedSelf: number;
};

/** 파일 하나에 대한 판정 — 모아서 UploadPlan 이 된다. */
type Decision = {
  insert?: UploadInsert;
  rearm?: Rearm;
  fill?: HashFill;
  hashUpdate?: HashUpdate;
  recovery?: UploadRecovery;
  due?: DueUpload;
  self?: boolean;
};

// 교체 알림은 PDF 만 낸다 — Office 파일은 브라우저에서 고치면 자동 저장마다 해시가 바뀌어
// 5분마다 메일이 간다. PDF 가 아닌 파일은 새로 생길 때만 알리고, 해시는 조용히 따라간다.
const isPdf = (name: string): boolean => /\.pdf$/i.test(name);

const baseRow = (file: RawDocFile) => ({
  item_id: file.id,
  name: file.name,
  folder_path: file.folder,
  web_url: file.webUrl,
  content_hash: file.hash,
});

/** 첫 실행: 지금 있는 파일에 메일을 쏟지 않도록 전부 seeded 로 적재만 한다. */
export function seedUploadRows(files: RawDocFile[]): UploadInsert[] {
  return files.map((file) => ({
    ...baseRow(file),
    change_kind: "new",
    state: "seeded",
    attempts: 0,
  }));
}

export function isManager(email: string | null, manager: string): boolean {
  if (email === null) return false;
  return email.trim().toLowerCase() === manager.trim().toLowerCase();
}

function isStale(row: UploadRow, now: Date): boolean {
  if (row.state !== "sending" || row.claimed_at === null) return false;
  const cutoff = now.getTime() - STALE_SENDING_MINUTES * 60_000;
  return new Date(row.claimed_at).getTime() < cutoff;
}

function decideNew(file: RawDocFile, manager: string): Decision {
  const self = isManager(file.createdByEmail ?? file.modifiedByEmail, manager);
  const insert: UploadInsert = {
    ...baseRow(file),
    change_kind: "new",
    state: self ? "skipped_self" : "pending",
    attempts: 0,
  };
  return self
    ? { insert, self }
    : { insert, due: { file, kind: "new", attempts: 0 } };
}

function decideSending(file: RawDocFile, row: UploadRow, now: Date): Decision {
  if (!isStale(row, now)) return {};
  if (row.attempts >= MAX_ATTEMPTS) {
    return { recovery: { item_id: row.item_id, state: "failed" } };
  }
  return {
    recovery: { item_id: row.item_id, state: "pending" },
    due: { file, kind: row.change_kind, attempts: row.attempts },
  };
}

function decideReplaced(
  file: RawDocFile,
  row: UploadRow,
  prevHash: string,
  hash: string,
  manager: string,
): Decision {
  const self = isManager(file.modifiedByEmail, manager);
  // 아직 안 나간 새 파일 소식은 새 파일로 남긴다 — 담당자는 '교체' 전에 '새 파일'도 못 받았다.
  const kind: ChangeKind =
    row.state === "pending" ? row.change_kind : "replaced";
  const rearm: Rearm = {
    ...baseRow(file),
    prevHash,
    content_hash: hash,
    change_kind: kind,
    state: self ? "skipped_self" : "pending",
  };
  return self ? { rearm, self } : { rearm, due: { file, kind, attempts: 0 } };
}

function pendingDue(file: RawDocFile, row: UploadRow): DueUpload | undefined {
  if (row.state !== "pending" || row.attempts >= MAX_ATTEMPTS) return undefined;
  return { file, kind: row.change_kind, attempts: row.attempts };
}

function decideExisting(
  file: RawDocFile,
  row: UploadRow,
  manager: string,
  now: Date,
): Decision {
  if (row.state === "sending") return decideSending(file, row, now);
  const prev = row.content_hash;
  const hash = file.hash;
  if (prev !== null && hash !== null && prev !== hash && isPdf(file.name)) {
    return decideReplaced(file, row, prev, hash, manager);
  }
  const due = pendingDue(file, row);
  if (prev !== null && hash !== null && prev !== hash) {
    return {
      hashUpdate: { item_id: row.item_id, prevHash: prev, content_hash: hash },
      due,
    };
  }
  if (prev === null && hash !== null) {
    return { fill: { item_id: row.item_id, content_hash: hash }, due };
  }
  return { due };
}

const pick = <K extends keyof Decision>(
  decisions: Decision[],
  key: K,
): NonNullable<Decision[K]>[] =>
  decisions.flatMap((d) =>
    d[key] === undefined ? [] : [d[key] as NonNullable<Decision[K]>],
  );

/** 목록에 있는 파일만 본다 — DB 에만 있는 행(지워진 파일)은 건드리지 않는다. */
export function reconcileUploads(
  files: RawDocFile[],
  rows: UploadRow[],
  manager: string,
  now: Date,
): UploadPlan {
  const byId = new Map(rows.map((r) => [r.item_id, r]));
  const decisions = files.map((file) => {
    const row = byId.get(file.id);
    return row
      ? decideExisting(file, row, manager, now)
      : decideNew(file, manager);
  });
  return {
    inserts: pick(decisions, "insert"),
    rearms: pick(decisions, "rearm"),
    fills: pick(decisions, "fill"),
    hashUpdates: pick(decisions, "hashUpdate"),
    recoveries: pick(decisions, "recovery"),
    due: pick(decisions, "due"),
    skippedSelf: decisions.filter((d) => d.self === true).length,
  };
}
