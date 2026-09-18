import {
  buildWorkload,
  workKey,
  type WorkloadOperator,
  type WorkloadSpan,
  type WorkloadWindows,
} from "../workload";
import {
  ASSIGNMENT_LIMITS,
  applyMoves,
  sumDeviation,
  type ProposedMove,
} from "./objective";

/**
 * 제약 검산 — **응답은 그대로 믿지 않는다**(§6.3 G1~G7).
 *
 * 이것이 없으면 모델이 44곳을 흩어 놓거나 한 사람에게 30곳을 몰아주는 배치가
 * 관리자 화면까지 올라온다. 순수 함수라 결정적이고, 모델 응답은 fixture 로 들어온다.
 *
 * **평가 순서가 곧 보고에 남는 이유다.** 순수 검사(G1~G4·G7)를 먼저 끝내고 누적
 * 상태를 보는 것(G5 상한 · G6 Σdev)을 뒤에 둔다 — 어차피 떨어질 줄이 상한을
 * 깎아먹으면 뒤 줄이 엉뚱한 이유로 탈락한다.
 */

export type GateId = "G1" | "G2" | "G3" | "G4" | "G5" | "G6" | "G7";

export type GateRejection = {
  move: ProposedMove;
  gate: GateId;
  /** 보고에 그대로 실린다 — 사람이 읽고 판단할 문장이어야 한다(F11). */
  reason: string;
};

/** 원장 한 칸. 하위유형·역할이 있어야 G4 가 갈린 건을 볼 수 있다. */
export type GateLedgerCell = {
  university_name: string;
  work_kind: string;
  subtype: string;
  role: string;
  assignee_email: string | null;
};

export type GateContext = {
  /**
   * 활성 명부 **전원**. `assignable=false` 도 넘긴다 — G1 이 '명부에 없다' 와
   * '배정 대상이 아니다' 를 갈라 말해야 보고가 조치로 이어진다.
   */
  operators: readonly WorkloadOperator[];
  ledger: readonly GateLedgerCell[];
  serviceCounts: Readonly<Record<string, number>>;
  spans: readonly WorkloadSpan[];
  windows: WorkloadWindows;
};

export type GateResult = {
  accepted: ProposedMove[];
  rejected: GateRejection[];
};

/** 배정은 운영 칸이다 — 개발자는 `operators` 밖이라 배정 대상이 될 수 없다(PR4b). */
const OPERATION_ROLE = "운영";

/**
 * 원장에서 '누가 쥐고 있나' 를 뽑는다. **G4 와 단건이 같은 판정을 써야 한다** —
 * 갈림의 정의가 두 벌이 되면 게이트가 막은 칸을 단건이 자동으로 채운다.
 *
 * 운영 칸만 본다. 개발 이름이 다르다고 갈린 것으로 세면 멀쩡한 대학이 전부
 * 손댈 수 없게 된다.
 */
export function ledgerHolders(ledger: readonly GateLedgerCell[]): {
  /** `대학|업무종류` → 담당자들. 둘 이상이면 하위유형이 갈린 것이다. */
  byKey: Map<string, Set<string | null>>;
  /** 대학 → 담당자들. 둘 이상이면 갈린 44곳이다. */
  byUniv: Map<string, Set<string | null>>;
} {
  const byKey = new Map<string, Set<string | null>>();
  const byUniv = new Map<string, Set<string | null>>();
  const add = (
    m: Map<string, Set<string | null>>,
    k: string,
    v: string | null,
  ) => {
    const set = m.get(k) ?? new Set<string | null>();
    set.add(v);
    m.set(k, set);
  };
  for (const c of ledger) {
    if (c.role !== OPERATION_ROLE) continue;
    add(byKey, workKey(c), c.assignee_email);
    add(byUniv, c.university_name, c.assignee_email);
  }
  return { byKey, byUniv };
}

export function runGates(
  moves: readonly ProposedMove[],
  ctx: GateContext,
): GateResult {
  const byEmail = new Map(ctx.operators.map((o) => [o.email, o]));
  const { byKey: holders, byUniv: holdersByUniv } = ledgerHolders(ctx.ledger);

  const accepted: ProposedMove[] = [];
  const rejected: GateRejection[] = [];
  const involvement = new Map<string, number>();
  let score = sumDeviation(
    buildWorkload({ ...ctx, operators: ctx.operators, cells: ctx.ledger }),
  );

  const reject = (move: ProposedMove, gate: GateId, reason: string) => {
    rejected.push({ move, gate, reason });
  };

  for (const m of moves) {
    const where = `${m.university_name} ${m.work_kind}`;

    // G1 — 제안 담당자가 배정 대상인가.
    const next = byEmail.get(m.next_assignee);
    if (!next) {
      reject(m, "G1", `${where}: 제안 담당자가 명부에 없습니다`);
      continue;
    }
    if (!next.assignable) {
      reject(m, "G1", `${where}: 제안 담당자가 배정 대상이 아닙니다`);
      continue;
    }

    // G2 — 경합. 판정이 도는 사이 사람이 손으로 고쳤을 수 있다(§5.4).
    const held = holders.get(workKey(m));
    if (!held) {
      reject(m, "G2", `${where}: 원장에 없는 칸입니다`);
      continue;
    }
    // **`size === 1` 을 여기서 보지 않는다** — 하위유형이 갈린 칸은 경합이 아니라
    // 분할이고, 그건 G4 가 제 이름으로 떨궈야 보고가 조치로 이어진다.
    if (!held.has(m.prev_assignee)) {
      reject(m, "G2", `${where}: 원장의 지금 담당자와 다릅니다`);
      continue;
    }

    // G3 — 그룹 밖 이동. 그룹 간 차이는 연차에 따라 의도된 것이다(§3.5).
    const prev = m.prev_assignee ? byEmail.get(m.prev_assignee) : undefined;
    if (!prev?.tenure_group) {
      reject(m, "G3", `${where}: 이전 담당자의 연차 그룹을 알 수 없습니다`);
      continue;
    }
    if (prev.tenure_group !== next.tenure_group) {
      reject(m, "G3", `${where}: 연차 그룹이 달라 옮길 수 없습니다`);
      continue;
    }

    // G4 — 갈린 건. 사람이 이유가 있어 갈라놓은 것으로 보고 보존한다(C4).
    if (held.size > 1) {
      reject(m, "G4", `${where}: 하위유형마다 담당자가 다른 칸입니다`);
      continue;
    }
    if ((holdersByUniv.get(m.university_name)?.size ?? 0) > 1) {
      reject(m, "G4", `${where}: 여러 운영자로 갈린 대학입니다`);
      continue;
    }

    // G7 — 근거. 여기서 보는 이유는 뒤의 두 게이트가 누적 상태를 건드리기 때문이다.
    if (m.reason.trim() === "") {
      reject(m, "G7", `${where}: 근거 문장이 비어 있습니다`);
      continue;
    }

    // G5 — 상한. 연속성이 1급 목표다(§6.1 λ).
    if (accepted.length >= ASSIGNMENT_LIMITS.perBatch) {
      reject(
        m,
        "G5",
        `${where}: 배치 상한 ${ASSIGNMENT_LIMITS.perBatch}곳을 넘습니다`,
      );
      continue;
    }
    const over = [m.prev_assignee, m.next_assignee].find(
      (e) =>
        e !== null &&
        (involvement.get(e) ?? 0) >= ASSIGNMENT_LIMITS.perOperator,
    );
    if (over) {
      reject(
        m,
        "G5",
        `${where}: 한 사람이 ${ASSIGNMENT_LIMITS.perOperator}곳을 넘게 관여합니다`,
      );
      continue;
    }

    // G6 — Σdev 개선. 앞서 받아들인 이동 위에서 잰다.
    const after = sumDeviation(
      buildWorkload({
        ...ctx,
        cells: applyMoves(ctx.ledger, [...accepted, m]),
      }),
    );
    if (!(after < score)) {
      reject(m, "G6", `${where}: 그룹 편차가 나아지지 않습니다`);
      continue;
    }

    score = after;
    accepted.push(m);
    for (const e of [m.prev_assignee, m.next_assignee]) {
      if (e) involvement.set(e, (involvement.get(e) ?? 0) + 1);
    }
  }

  return { accepted, rejected };
}
