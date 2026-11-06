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
  // 아직 안 나간 알림(남이 올린 새 파일 등)은 담당자가 그 뒤 고쳐도 그대로 나간다 —
  // 담당자는 그 소식을 아직 못 받았다. 새 파일 소식은 '교체'가 아니라 새 파일로 남긴다.
  const unsent = row.state === "pending";
  const self = !unsent && isManager(file.modifiedByEmail, manager);
  const kind: ChangeKind = unsent ? row.change_kind : "replaced";
  const rearm: Rearm = {
    ...baseRow(file),
    prevHash,
    prevState: row.state,
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

type Judged = { decision: Decision; carriedSince: string | null };

// 앞 실행에서 넘어온 알림(대기·회수)이 먼저, 처음 본 순으로. 이번에 생긴 것(새 파일·교체)은
// 목록 순으로 뒤에 — 한 실행에 보내는 건수에 상한이 있어 오래 기다린 것부터 나가게.
function oldestFirst(judged: Judged[]): DueUpload[] {
  const withDue = judged.filter((j) => j.decision.due !== undefined);
  const carried = withDue
    .filter((j) => j.carriedSince !== null)
    .sort((a, b) => (a.carriedSince ?? "").localeCompare(b.carriedSince ?? ""));
  const fresh = withDue.filter((j) => j.carriedSince === null);
  return [...carried, ...fresh].map((j) => j.decision.due as DueUpload);
}

function judge(
  file: RawDocFile,
  row: UploadRow | undefined,
  manager: string,
  now: Date,
): Judged {
  if (!row) return { decision: decideNew(file, manager), carriedSince: null };
  const decision = decideExisting(file, row, manager, now);
  return {
    decision,
    carriedSince: decision.rearm === undefined ? row.first_seen_at : null,
  };
}

/** 목록에 있는 파일만 본다 — DB 에만 있는 행(지워진 파일)은 건드리지 않는다. */
export function reconcileUploads(
  files: RawDocFile[],
  rows: UploadRow[],
  manager: string,
  now: Date,
): UploadPlan {
  const byId = new Map(rows.map((r) => [r.item_id, r]));
  const judged = files.map((file) =>
    judge(file, byId.get(file.id), manager, now),
  );
  const decisions = judged.map((j) => j.decision);
  return {
    inserts: pick(decisions, "insert"),
    rearms: pick(decisions, "rearm"),
    fills: pick(decisions, "fill"),
    hashUpdates: pick(decisions, "hashUpdate"),
    recoveries: pick(decisions, "recovery"),
    due: oldestFirst(judged),
    skippedSelf: decisions.filter((d) => d.self === true).length,
  };
}
