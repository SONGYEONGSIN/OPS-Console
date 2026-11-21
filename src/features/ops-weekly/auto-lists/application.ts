/**
 * 원서접수 자동 목록 — 운영자별로 미리 채워 두는 다섯 묶음.
 * 묶음끼리는 배타적이지 않다(접수 중이면서 차주 마감인 건은 둘 다 든다).
 * 차주 마감 예정은 접수 마감(`write_end_at`)이다 — 결제 마감(`pay_end_at`)이 아니다.
 */
import { phaseOf } from "@/features/closing/phase";
import { nextWeekRange, opensNextWeek } from "@/features/closing/next-week";
import type { DevStage } from "../dev-status";
import { kstYmd, referenceInstant, ymdInRange } from "../week";

export type ClosingLite = {
  service_id: number;
  university_name: string;
  service_name: string;
  operator_name: string | null;
  write_start_at: string | null;
  write_end_at: string;
  pay_end_at: string | null;
  university_type?: string | null;
  category?: string | null;
};

export type AutoItem = {
  key: string;
  title: string;
  subtitle: string;
  at: string | null;
  /** 원서접수만 — 표의 대학구분·카테고리 칸. 이 칸이 생기기 전에 굳힌 스냅샷에는 없다 */
  universityType?: string | null;
  category?: string | null;
  /** 전체 보고에서만 — 이 건을 맡은 작성자 이름(같은 서비스를 여럿이 맡으면 여럿) */
  owners?: string[];
};

export type ApplicationGroups = {
  dev: AutoItem[];
  test: AutoItem[];
  unknown: AutoItem[];
  opening: AutoItem[];
  running: AutoItem[];
  closing: AutoItem[];
  devStatusCollected: boolean;
};

export function endsNextWeek(writeEndAt: string, ref: Date): boolean {
  const t = new Date(writeEndAt);
  if (Number.isNaN(t.getTime())) return false;
  return ymdInRange(kstYmd(t), nextWeekRange(ref));
}

function toItem(row: ClosingLite, at: string | null): AutoItem {
  return {
    key: `closing:${row.service_id}`,
    title: row.university_name,
    subtitle: row.service_name,
    at,
    universityType: row.university_type ?? null,
    category: row.category ?? null,
  };
}

function atMs(at: string | null): number {
  const t = at ? Date.parse(at) : NaN;
  return Number.isNaN(t) ? Number.POSITIVE_INFINITY : t;
}

function sorted(items: AutoItem[]): AutoItem[] {
  return [...items].sort((a, b) => {
    const d = atMs(a.at) - atMs(b.at);
    if (d !== 0 && !Number.isNaN(d)) return d;
    return a.title.localeCompare(b.title, "ko");
  });
}

export function sameName(a: string | null, b: string): boolean {
  return a !== null && a.trim() === b.trim();
}

export function buildApplicationGroups(args: {
  rows: readonly ClosingLite[];
  operatorName: string;
  devStages: ReadonlyMap<number, DevStage>;
  /** 그 주에 수집이 돌았는가 — 전역 사실이다. 본인 구분 건수로 추론하면 시작 전 0건인 사람이 늘 '수집 안 됨' 이 된다. */
  devStatusCollected: boolean;
  weekStart: string;
  now: Date;
}): ApplicationGroups {
  const ref = referenceInstant(args.weekStart, args.now);
  const out: ApplicationGroups = {
    dev: [],
    test: [],
    unknown: [],
    opening: [],
    running: [],
    closing: [],
    devStatusCollected: args.devStatusCollected,
  };
  for (const row of args.rows) {
    if (!sameName(row.operator_name, args.operatorName)) continue;
    const phase = phaseOf(row, ref);
    if (phase === "upcoming") {
      const stage = args.devStages.get(row.service_id);
      // 리얼배포가 끝났으면 개발도 테스트도 미확인도 아니다 — 오픈 주가 오면 차주 오픈 예정에 든다.
      if (stage !== "deployed") {
        out[stage ?? "unknown"].push(toItem(row, row.write_start_at));
      }
    }
    if (opensNextWeek(row.write_start_at, ref)) {
      out.opening.push(toItem(row, row.write_start_at));
    }
    if (phase === "running") out.running.push(toItem(row, row.write_start_at));
    if (endsNextWeek(row.write_end_at, ref)) {
      out.closing.push(toItem(row, row.write_end_at));
    }
  }
  return {
    ...out,
    dev: sorted(out.dev),
    test: sorted(out.test),
    unknown: sorted(out.unknown),
    opening: sorted(out.opening),
    running: sorted(out.running),
    closing: sorted(out.closing),
  };
}

/** 다섯 묶음 중 어딘가에 드는데 담당이 명단에 안 붙는 행(행 단위, 중복 없음). 개수는 이 목록의 길이다. */
export function listUnmatchedApplication(args: {
  rows: readonly ClosingLite[];
  writerNames: ReadonlySet<string>;
  weekStart: string;
  now: Date;
}): ClosingLite[] {
  const ref = referenceInstant(args.weekStart, args.now);
  return args.rows.filter((row) => {
    const name = row.operator_name?.trim() ?? "";
    if (name !== "" && args.writerNames.has(name)) return false;
    return (
      phaseOf(row, ref) !== "closed" ||
      opensNextWeek(row.write_start_at, ref) ||
      endsNextWeek(row.write_end_at, ref)
    );
  });
}

export function countUnmatchedApplication(
  args: Parameters<typeof listUnmatchedApplication>[0],
): number {
  return listUnmatchedApplication(args).length;
}
