"use client";

import { useState } from "react";
import type { ListRow } from "../patterns/ListPattern";
import {
  OPERATORS,
  ageOf,
  tenureLabel,
  tenureYears,
} from "@/features/auth/operators";
import {
  PERMISSION_LABEL,
  type OperatorPermission,
} from "@/features/operators/schemas";
import { postStatusKeys, postStatusLabel } from "../patterns/ListPattern";
import { sidebarSections, type SbItem } from "../../_data";
import { SendReceivablesMailButton } from "@/components/receivables/SendReceivablesMailButton";
import {
  AI_TOOL_LABEL,
  AI_TOOL_OPTIONS,
  AI_TOOL_TONE,
  CATEGORY_LABEL,
  CATEGORY_OPTIONS,
  CATEGORY_TONE,
} from "@/lib/ai-work/constants";
import type { AiTool, AiWorkCategory } from "@/features/ai-work/schemas";

type Variant =
  | "default"
  | "team"
  | "post-feedback"
  | "post-notice"
  | "schedule"
  | "my-todo"
  | "cohort"
  | "receivables"
  | "ai-work";

type Props = {
  row: ListRow;
  editing: boolean;
  onSave: (next: ListRow) => void;
  onCancel: () => void;
  variant?: Variant;
  /** team variant — 권한 select admin만 노출하기 위한 컨텍스트 */
  currentUserPermission?: OperatorPermission | null;
  /** cohort variant — 초대 메일 발송/재초대 (admin only). server action wrapper. */
  onInvite?: (id: string) => Promise<{ ok: boolean; error?: string }>;
  /** receivables variant — 적요 셀 PATCH server action. */
  onUpdateRemarks?: (
    row: ListRow,
    newText: string,
  ) => Promise<{ ok: boolean; error?: string }>;
  /** receivables variant — 독려 메일 발송이 dry-run 모드인지 (env 기반). */
  receivablesMailDryRun?: boolean;
};

/**
 * InspectorListBody — list pattern row 인스펙터 본문.
 * mockup folio-dashboard.html 의 인스펙터 패널 구조 매칭:
 *   1) 헤더 (overline · title · meta · 상태 동그라미)
 *   2) 속성 section
 *   3) 실시간 지표 section
 *   4) 담당 · 온콜 section
 * 데모 데이터는 row 정보 기반 + 고정 mock 혼합.
 */
export function InspectorListBody({
  row,
  editing,
  onSave,
  onCancel,
  variant = "default",
  currentUserPermission = null,
  onInvite,
  onUpdateRemarks,
  receivablesMailDryRun = true,
}: Props) {
  const [draft, setDraft] = useState<ListRow>(row);

  if (!editing) {
    return (
      <ViewMode
        row={row}
        variant={variant}
        currentUserPermission={currentUserPermission}
        receivablesMailDryRun={receivablesMailDryRun}
      />
    );
  }

  const isTeam = variant === "team";
  const isPost = variant === "post-feedback" || variant === "post-notice";
  const postVariant: "post-feedback" | "post-notice" | null = isPost ? variant : null;
  const isSchedule = variant === "schedule";
  const isMyTodo = variant === "my-todo";
  const canEditPermission = isTeam && currentUserPermission === "admin";

  if (isSchedule) {
    return <ScheduleForm row={draft} setRow={setDraft} onSave={onSave} onCancel={onCancel} />;
  }

  if (isMyTodo) {
    return <MyTodoForm row={draft} setRow={setDraft} onSave={onSave} onCancel={onCancel} />;
  }

  if (variant === "cohort") {
    return (
      <CohortForm
        row={draft}
        setRow={setDraft}
        onSave={onSave}
        onCancel={onCancel}
        onInvite={onInvite}
      />
    );
  }

  if (variant === "receivables") {
    return (
      <ReceivablesForm
        row={draft}
        setRow={setDraft}
        onSave={onSave}
        onCancel={onCancel}
      />
    );
  }

  if (variant === "ai-work") {
    return (
      <AiWorkForm
        row={draft}
        setRow={setDraft}
        onSave={onSave}
        onCancel={onCancel}
      />
    );
  }

  if (isPost && postVariant) {
    return (
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSave(draft);
        }}
        className="space-y-3"
      >
        <label className="block text-xs">
          <span className="mb-1 block text-muted">제목</span>
          <input
            aria-label="제목"
            value={draft.name}
            onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            className="w-full border border-line bg-cream px-2 py-1 text-ink"
            placeholder="제목을 입력해주세요"
          />
        </label>
        <label className="block text-xs">
          <span className="mb-1 block text-muted">내용</span>
          <textarea
            aria-label="내용"
            value={draft.body ?? ""}
            onChange={(e) => setDraft({ ...draft, body: e.target.value })}
            rows={8}
            className="w-full border border-line bg-cream px-2 py-1 text-ink"
            placeholder="본문을 작성해주세요"
          />
        </label>
        <label className="block text-xs">
          <span className="mb-1 block text-muted">등록자</span>
          <select
            aria-label="등록자"
            value={draft.author ?? ""}
            onChange={(e) => setDraft({ ...draft, author: e.target.value })}
            className="w-full border border-line bg-cream px-2 py-1 text-ink"
          >
            <option value="">선택…</option>
            {(postVariant === "post-notice"
              ? OPERATORS.filter(
                  (o) => o.role === "부장" || o.role === "팀장",
                )
              : OPERATORS
            ).map((op) => (
              <option key={op.email} value={op.name}>
                {op.name} · {op.role}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-xs">
          <span className="mb-1 block text-muted">상태</span>
          <select
            aria-label="상태"
            value={draft.status}
            onChange={(e) =>
              setDraft({ ...draft, status: e.target.value as ListRow["status"] })
            }
            className="w-full border border-line bg-cream px-2 py-1 text-ink"
          >
            {postStatusKeys(postVariant).map((s) => (
              <option key={s} value={s}>
                {postStatusLabel(postVariant, s)}
              </option>
            ))}
          </select>
        </label>
        <div className="flex gap-2 pt-2">
          <button
            type="submit"
            className="flex-1 border border-line bg-ink px-3 py-1.5 text-sm font-medium text-cream hover:bg-ink/90"
          >
            저장
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 border border-line bg-transparent px-3 py-1.5 text-sm text-ink hover:bg-washi"
          >
            취소
          </button>
        </div>
        {row.id !== "" && (
          <div className="border-t border-line-soft pt-3">
            <button
              type="button"
              onClick={() => {
                if (
                  window.confirm(
                    "이 글을 삭제하시겠습니까? 되돌릴 수 없습니다.",
                  )
                ) {
                  onSave({ ...draft, status: "deleted" });
                }
              }}
              className="w-full border border-vermilion-deep bg-transparent px-3 py-1.5 text-sm text-vermilion-deep hover:bg-vermilion-deep hover:text-cream"
            >
              삭제
            </button>
          </div>
        )}
      </form>
    );
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSave(draft);
      }}
      className="space-y-3"
    >
      <label className="block text-xs">
        <span className="mb-1 block text-muted">이름</span>
        <input
          aria-label="이름"
          value={draft.name}
          onChange={(e) => setDraft({ ...draft, name: e.target.value })}
          className="w-full border border-line bg-cream px-2 py-1 text-ink"
        />
      </label>
      <label className="block text-xs">
        <span className="mb-1 block text-muted">{isTeam ? "이메일" : "ID"}</span>
        <input
          aria-label={isTeam ? "이메일" : "ID"}
          value={draft.id}
          onChange={(e) => setDraft({ ...draft, id: e.target.value })}
          className="w-full border border-line bg-cream px-2 py-1 font-mono text-ink"
        />
      </label>
      <label className="block text-xs">
        <span className="mb-1 block text-muted">{isTeam ? "팀" : "담당"}</span>
        {isTeam ? (
          <select
            aria-label="팀"
            value={draft.owner}
            onChange={(e) => setDraft({ ...draft, owner: e.target.value })}
            className="w-full border border-line bg-cream px-2 py-1 text-ink"
          >
            <option value="운영1팀">운영1팀</option>
            <option value="운영2팀">운영2팀</option>
          </select>
        ) : (
          <input
            aria-label="담당"
            value={draft.owner}
            onChange={(e) => setDraft({ ...draft, owner: e.target.value })}
            className="w-full border border-line bg-cream px-2 py-1 text-ink"
          />
        )}
      </label>
      {isTeam && (
        <>
          <label className="block text-xs">
            <span className="mb-1 block text-muted">직급</span>
            <select
              aria-label="직급"
              value={draft.meta ?? ""}
              onChange={(e) => setDraft({ ...draft, meta: e.target.value })}
              className="w-full border border-line bg-cream px-2 py-1 text-ink"
            >
              <option value="부장">부장</option>
              <option value="팀장">팀장</option>
              <option value="TL">TL</option>
              <option value="매니저">매니저</option>
            </select>
          </label>
          <label className="block text-xs">
            <span className="mb-1 block text-muted">
              직속 상사 <span className="text-faint">(미설정 시 자동)</span>
            </span>
            <select
              aria-label="직속 상사"
              value={draft.leader ?? ""}
              onChange={(e) => setDraft({ ...draft, leader: e.target.value })}
              className="w-full border border-line bg-cream px-2 py-1 text-ink"
            >
              <option value="">자동 derive (팀장/부장)</option>
              {OPERATORS.filter((x) => x.email !== draft.id).map((op) => (
                <option key={op.email} value={op.name}>
                  {op.name} · {op.role} · {op.team}
                </option>
              ))}
              <option value="본부장 (외부)">본부장 (외부)</option>
            </select>
          </label>
        </>
      )}
      <label className="block text-xs">
        <span className="mb-1 block text-muted">상태</span>
        <select
          aria-label="상태"
          value={draft.status}
          onChange={(e) =>
            setDraft({ ...draft, status: e.target.value as ListRow["status"] })
          }
          className="w-full border border-line bg-cream px-2 py-1 text-ink"
        >
          {isTeam ? (
            <>
              <option value="active">활성</option>
              <option value="inactive">점검중</option>
              <option value="suspended">정지</option>
              <option value="deleted">삭제</option>
            </>
          ) : (
            <>
              <option value="active">활성</option>
              <option value="approved">정상</option>
              <option value="review">점검중</option>
              <option value="urgent">긴급</option>
            </>
          )}
        </select>
      </label>
      {canEditPermission && (
        <label className="block text-xs">
          <span className="mb-1 block text-muted">권한</span>
          <select
            aria-label="권한"
            value={draft.permission ?? "member"}
            onChange={(e) =>
              setDraft({
                ...draft,
                permission: e.target.value as OperatorPermission,
              })
            }
            className="w-full border border-line bg-cream px-2 py-1 text-ink"
          >
            <option value="admin">관리자 (admin)</option>
            <option value="member">구성원 (member)</option>
            <option value="viewer">뷰어 (viewer)</option>
          </select>
        </label>
      )}
      {canEditPermission && (
        <fieldset className="block text-xs">
          <legend className="mb-1 block text-muted">메뉴 권한</legend>
          <div className="space-y-3 border border-line bg-cream p-2">
            {sidebarSections.map((section) => {
              const items: SbItem[] = section.entries
                .flatMap<SbItem>((e) =>
                  e.kind === "item" ? [e] : e.items
                )
                .filter((it) => !!it.slug);
              if (items.length === 0) return null;
              return (
                <div key={section.title}>
                  <p className="mb-1 text-2xs uppercase tracking-[0.18em] text-muted">
                    {section.title}
                  </p>
                  <div className="grid grid-cols-2 gap-1">
                    {items.map((it) => {
                      const slug = it.slug!;
                      const checked = (draft.allowedMenus ?? []).includes(slug);
                      return (
                        <label
                          key={slug}
                          className="flex items-center gap-1.5 text-ink"
                        >
                          <input
                            type="checkbox"
                            aria-label={slug}
                            checked={checked}
                            onChange={(e) => {
                              const current = draft.allowedMenus ?? [];
                              const next = e.target.checked
                                ? [...current, slug]
                                : current.filter((s) => s !== slug);
                              setDraft({ ...draft, allowedMenus: next });
                            }}
                            className="h-3.5 w-3.5"
                          />
                          <span className="truncate">{it.label}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </fieldset>
      )}
      {isTeam && draft.status === "deleted" && (
        <label className="block text-xs">
          <span className="mb-1 block text-muted">
            삭제 사유 <span className="text-vermilion">*</span>
          </span>
          <textarea
            aria-label="삭제 사유"
            required
            rows={3}
            value={draft.deletedReason ?? ""}
            onChange={(e) =>
              setDraft({ ...draft, deletedReason: e.target.value })
            }
            placeholder="퇴사 / 권한 회수 / 부서 이동 등"
            className="w-full border border-line bg-cream px-2 py-1 text-ink"
          />
        </label>
      )}
      <div className="flex gap-2 pt-2">
        <button
          type="submit"
          className="flex-1 border border-line bg-ink px-3 py-1.5 text-sm font-medium text-cream hover:bg-ink/90"
        >
          저장
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 border border-line bg-transparent px-3 py-1.5 text-sm text-ink hover:bg-washi"
        >
          취소
        </button>
      </div>
    </form>
  );
}

/* ════════════════════════════════════════════════════════════
   ViewMode — mockup 3섹션 풍부 구조
   ════════════════════════════════════════════════════════════ */
function ViewMode({
  row,
  variant,
  currentUserPermission = null,
  receivablesMailDryRun = true,
}: {
  row: ListRow;
  variant: Variant;
  currentUserPermission?: OperatorPermission | null;
  receivablesMailDryRun?: boolean;
}) {
  if (variant === "team") return <TeamView row={row} />;
  if (variant === "post-feedback" || variant === "post-notice")
    return <PostView row={row} variant={variant} />;
  if (variant === "cohort") return <CohortView row={row} />;
  if (variant === "receivables")
    return (
      <ReceivablesView
        row={row}
        canSendMail={currentUserPermission === "admin"}
        mailDryRun={receivablesMailDryRun}
      />
    );
  if (variant === "ai-work") return <AiWorkView row={row} />;
  return <ServiceView row={row} />;
}

/**
 * 청구일자(text)로부터 오늘(KST)까지의 경과 일수.
 * 파싱 실패 또는 미래 일자면 null.
 */
function elapsedDays(dateText?: string): number | null {
  if (!dateText) return null;
  const d = new Date(dateText.trim());
  if (Number.isNaN(d.getTime())) return null;
  const diff = Date.now() - d.getTime();
  if (diff < 0) return null;
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const SCHOOL_OWNER_HEADER_RE = /^학교\s*담당자?$|^학교\s*담당\s*이메일$/;

/**
 * 다양한 한국식 날짜 표기를 input type="date" 가 받을 수 있는 ISO 8601 (YYYY-MM-DD) 으로 정규화.
 * 변환 실패 시 빈 문자열 — 사용자가 달력으로 새로 선택 가능.
 *
 * 지원 형식: 2026-05-30 / 2026.05.30 / 2026/05/30 / 2026년 5월 30일 / Excel serial(45777)
 */
function toISODateInput(raw: string | undefined | null): string {
  if (!raw) return "";
  const s = String(raw).trim();
  if (!s) return "";

  // 이미 ISO
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) return s;

  // 2026.05.30 / 2026/05/30
  const dotted = s.match(/^(\d{4})[./](\d{1,2})[./](\d{1,2})$/);
  if (dotted) {
    const [, y, m, d] = dotted;
    return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }

  // 2026년 5월 30일
  const korean = s.match(/^(\d{4})\s*년\s*(\d{1,2})\s*월\s*(\d{1,2})\s*일$/);
  if (korean) {
    const [, y, m, d] = korean;
    return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }

  // Excel serial number (1900-01-01 기준)
  const serial = Number(s);
  if (Number.isFinite(serial) && serial > 25569 && serial < 80000) {
    const ms = (serial - 25569) * 86400 * 1000;
    const d = new Date(ms);
    if (!Number.isNaN(d.getTime())) {
      const y = d.getUTCFullYear();
      const mo = String(d.getUTCMonth() + 1).padStart(2, "0");
      const da = String(d.getUTCDate()).padStart(2, "0");
      return `${y}-${mo}-${da}`;
    }
  }

  return "";
}

function pickSchoolOwnerEmail(cells: ListRow["receivablesCells"]): string | null {
  if (!cells) return null;
  const idx = cells.headers.findIndex((h) => SCHOOL_OWNER_HEADER_RE.test(h));
  if (idx === -1) return null;
  const raw = (cells.textValues[idx] ?? "").trim();
  if (!raw || !EMAIL_RE.test(raw)) return null;
  return raw;
}

function ReceivablesView({
  row,
  canSendMail = false,
  mailDryRun = true,
}: {
  row: ListRow;
  canSendMail?: boolean;
  mailDryRun?: boolean;
}) {
  const cells = row.receivablesCells;
  const elapsed = elapsedDays(row.meta);
  const schoolOwnerEmail = pickSchoolOwnerEmail(cells);
  const isPaidByRemarks = /입금\s*완료/.test(cells?.remarks ?? "");
  return (
    <div className="space-y-6">
      {canSendMail && schoolOwnerEmail && !isPaidByRemarks ? (
        <div className="flex justify-end">
          <SendReceivablesMailButton
            email={schoolOwnerEmail}
            customerName={row.name}
            dryRun={mailDryRun}
          />
        </div>
      ) : null}
      <Section title="기본 정보">
        <DefList
          items={[
            { term: "거래처", desc: row.name || "-" },
            { term: "청구일자", desc: row.meta ?? "-" },
            {
              term: "청구금액",
              desc: (
                <span className="font-mono text-ink">{row.author ?? "-"}</span>
              ),
            },
            {
              term: "경과일수",
              desc:
                elapsed === null ? (
                  <span className="text-muted">-</span>
                ) : (
                  <span
                    className={
                      row.status === "approved"
                        ? "text-muted"
                        : elapsed >= 60
                          ? "font-medium text-vermilion-deep"
                          : elapsed >= 30
                            ? "text-vermilion"
                            : "text-ink"
                    }
                  >
                    {elapsed}일 경과
                  </span>
                ),
            },
            {
              term: "입금여부",
              desc: (
                <span
                  className={`inline-block px-2 py-0.5 text-xs ${
                    row.status === "approved"
                      ? "bg-washi-raised text-ink"
                      : "bg-vermilion/20 text-vermilion-deep"
                  }`}
                >
                  {row.status === "approved" ? "수금" : "미수"}
                </span>
              ),
            },
          ]}
        />
      </Section>

      {row.body && (
        <>
          <Divider />
          <Section title="거래내역">
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-ink">
              {row.body}
            </p>
          </Section>
        </>
      )}

      {cells && cells.headers.length > 0 && (
        <>
          <Divider />
          <Section title="전체 컬럼 (Excel 원본)">
            <DefList
              items={cells.headers.map((h, i) => ({
                term: h,
                desc:
                  cells.textValues[i] !== undefined &&
                  cells.textValues[i] !== ""
                    ? cells.textValues[i]
                    : "—",
              }))}
            />
          </Section>
        </>
      )}
    </div>
  );
}

const COHORT_STATUS_VIEW_LABEL: Record<
  NonNullable<ListRow["cohortStatus"]>,
  { label: string; color: string }
> = {
  planned: { label: "계획", color: "bg-line-soft text-muted" },
  in_progress: { label: "진행중", color: "bg-vermilion text-cream" },
  completed: { label: "완료", color: "bg-washi-raised text-ink" },
};

function CohortView({ row }: { row: ListRow }) {
  const trainee = row.traineeEmail
    ? OPERATORS.find((o) => o.email === row.traineeEmail)
    : null;
  const mentor = row.mentorEmail
    ? OPERATORS.find((o) => o.email === row.mentorEmail)
    : null;
  const status = row.cohortStatus
    ? COHORT_STATUS_VIEW_LABEL[row.cohortStatus]
    : null;
  const inviteState = row.acceptedAt
    ? "수락 완료"
    : row.invitedAt
      ? "초대 발송 — 수락 대기"
      : "미초대";
  const inviteColor = row.acceptedAt
    ? "bg-washi-raised text-ink-soft"
    : row.invitedAt
      ? "bg-vermilion/20 text-vermilion-deep"
      : "bg-line-soft text-muted";

  return (
    <div className="space-y-6">
      <Section title="회차 정보">
        <DefList
          items={[
            {
              term: "회차",
              desc: <span className="font-medium text-ink">{row.name}</span>,
            },
            {
              term: "기간",
              desc: row.endDate
                ? `${row.startDate ?? "-"} ~ ${row.endDate}`
                : `${row.startDate ?? "-"} ~ 진행 중`,
            },
            {
              term: "상태",
              desc: status ? (
                <span
                  className={`inline-block px-2 py-0.5 text-xs ${status.color}`}
                >
                  {status.label}
                </span>
              ) : (
                "-"
              ),
            },
            {
              term: "초대",
              desc: (
                <span
                  className={`inline-block px-2 py-0.5 text-xs ${inviteColor}`}
                >
                  {inviteState}
                </span>
              ),
            },
          ]}
        />
      </Section>

      <Divider />

      <Section title="신입 (Trainee)">
        {trainee ? (
          <DefList
            items={[
              { term: "이름", desc: trainee.name },
              { term: "팀", desc: trainee.team },
              { term: "직급", desc: trainee.role },
              {
                term: "이메일",
                desc: <span className="font-mono text-xs">{trainee.email}</span>,
              },
              { term: "사번", desc: trainee.empNo },
              {
                term: "재직",
                desc: tenureLabel(trainee.hiredAt),
              },
              { term: "나이", desc: `${ageOf(trainee.birthDate)}세` },
            ]}
          />
        ) : (
          <DefList
            items={[
              {
                term: "이메일",
                desc: (
                  <span className="font-mono text-xs">
                    {row.traineeEmail ?? "-"}
                  </span>
                ),
              },
              {
                term: "안내",
                desc: (
                  <span className="text-xs text-muted">
                    operators 시드에 없는 외부 이메일 — 초대 수락 시 자동 등록 후
                    admin이 권한 승계
                  </span>
                ),
              },
            ]}
          />
        )}
      </Section>

      <Divider />

      <Section title="교육 (Mentor)">
        {mentor ? (
          <DefList
            items={[
              { term: "이름", desc: mentor.name },
              { term: "팀", desc: mentor.team },
              { term: "직급", desc: mentor.role },
              {
                term: "이메일",
                desc: <span className="font-mono text-xs">{mentor.email}</span>,
              },
              {
                term: "재직",
                desc: tenureLabel(mentor.hiredAt),
              },
            ]}
          />
        ) : (
          <p className="text-xs text-muted">교육 미정 — 회차 편집에서 지정</p>
        )}
      </Section>

      <Divider />

      <Section title="초대 워크플로">
        <DefList
          items={[
            {
              term: "발송",
              desc: row.invitedAt
                ? new Intl.DateTimeFormat("ko-KR", {
                    timeZone: "Asia/Seoul",
                    dateStyle: "medium",
                    timeStyle: "short",
                  }).format(new Date(row.invitedAt))
                : "—",
            },
            {
              term: "수락",
              desc: row.acceptedAt
                ? new Intl.DateTimeFormat("ko-KR", {
                    timeZone: "Asia/Seoul",
                    dateStyle: "medium",
                    timeStyle: "short",
                  }).format(new Date(row.acceptedAt))
                : "—",
            },
          ]}
        />
        {!row.invitedAt && (
          <p className="mt-2 text-xs text-muted">
            아직 초대 메일을 발송하지 않았습니다. 우측 상단 &ldquo;구성 편집&rdquo;
            → 하단 &ldquo;초대 메일 발송&rdquo;에서 시작.
          </p>
        )}
      </Section>

      {row.body && (
        <>
          <Divider />
          <Section title="비고">
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-ink">
              {row.body}
            </p>
          </Section>
        </>
      )}

      <Divider />

      <Section title="진행 (후속 epic)">
        <p className="text-xs text-muted">
          체크리스트 진행률 · 활동 로그 · Q&amp;A는 후속 PR에서 추가됩니다.
        </p>
      </Section>
    </div>
  );
}

function PostView({
  row,
  variant,
}: {
  row: ListRow;
  variant: "post-feedback" | "post-notice";
}) {
  const statusLabel = postStatusLabel(variant, row.status);
  const statusColor = STATUS_BADGE[row.status];

  return (
    <div className="space-y-6">
      <Section title="게시글 정보">
        <DefList
          items={[
            { term: "글번호", desc: <span className="font-mono">{row.slug ?? (row.id || "-")}</span> },
            { term: "등록자", desc: row.author || "-" },
            { term: "작성일", desc: row.meta ?? "-" },
            {
              term: "상태",
              desc: (
                <span className={`inline-block px-2 py-0.5 text-xs ${statusColor}`}>
                  {statusLabel}
                </span>
              ),
            },
          ]}
        />
      </Section>

      <Divider />

      <Section title="본문">
        {row.body ? (
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-ink">
            {row.body}
          </p>
        ) : (
          <p className="text-xs text-muted">(본문이 비어 있습니다)</p>
        )}
      </Section>
    </div>
  );
}


function ServiceView({ row }: { row: ListRow }) {
  const statusLabel = STATUS_LABEL[row.status];
  const statusColor = STATUS_BADGE[row.status];

  return (
    <div className="space-y-6">
      <Section title="속성">
        <DefList
          items={[
            { term: "항목 ID", desc: <span className="font-mono">{row.id}</span> },
            { term: "네임스페이스", desc: "ops / 운영" },
            { term: "담당", desc: row.owner },
            { term: "포트", desc: ":8080 HTTP · :9000 gRPC" },
            { term: "리전", desc: "ap-northeast-2 · 3 AZ" },
            { term: "런타임", desc: "Node 22 · Next.js 16" },
            {
              term: "상태",
              desc: (
                <span className={`inline-block px-2 py-0.5 text-xs ${statusColor}`}>
                  {statusLabel}
                </span>
              ),
            },
          ]}
        />
      </Section>

      <Divider />

      <Section title="실시간 지표">
        <DefList
          items={[
            {
              term: "처리량",
              desc: (
                <span>
                  12,480 req/s <span className="text-sage">▲ 8.2%</span> 전일 대비
                </span>
              ),
            },
            {
              term: "p99 응답",
              desc: (
                <strong className="font-bold text-vermilion">
                  184 ms · 임계 150ms 초과
                </strong>
              ),
            },
            {
              term: "오류율",
              desc: (
                <strong className="font-bold text-vermilion">
                  0.42% · 경고 단계
                </strong>
              ),
            },
            { term: "CPU", desc: "62% · 12 인스턴스 평균" },
            {
              term: "메모리",
              desc: <span className="text-gold">78% · 임계 85% 근접</span>,
            },
          ]}
        />
      </Section>

      <Divider />

      <Section title="담당 · 온콜">
        <DefList
          items={[
            { term: "담당 팀", desc: `${row.owner} · L3 엔지니어링` },
            { term: "1차 온콜", desc: "박현주 · 다음 교대까지 7시간" },
            { term: "2차 온콜", desc: "김지현" },
            { term: "에스컬레이션", desc: "플랫폼 엔지니어링 (자동 · T+30m)" },
          ]}
        />
      </Section>
    </div>
  );
}

function TeamView({ row }: { row: ListRow }) {
  const statusLabel = STATUS_LABEL[row.status];
  const statusColor = STATUS_BADGE[row.status];
  const op = OPERATORS.find((x) => x.email === row.id);

  // OPERATORS lookup 실패 시 (예: 테스트 더미 데이터) 기존 row 기반 단순 노출.
  if (!op) {
    return (
      <div className="space-y-6">
        <Section title="계정 정보">
          <DefList
            items={[
              { term: "이름", desc: <strong className="font-semibold">{row.name}</strong> },
              { term: "이메일", desc: <span className="font-mono text-xs">{row.id}</span> },
              {
                term: "시스템 권한",
                desc: row.permission ? PERMISSION_LABEL[row.permission] : "-",
              },
              { term: "소속 팀", desc: row.owner },
              { term: "직급", desc: row.meta ?? "-" },
              {
                term: "상태",
                desc: (
                  <span className={`inline-block px-2 py-0.5 text-xs ${statusColor}`}>
                    {statusLabel}
                  </span>
                ),
              },
            ]}
          />
        </Section>
      </div>
    );
  }

  const tenure = tenureLabel(op.hiredAt);
  const tenureY = tenureYears(op.hiredAt);
  const age = ageOf(op.birthDate);

  return (
    <div className="space-y-6">
      <Section title="인사 정보">
        <DefList
          items={[
            { term: "사번", desc: <span className="font-mono">{op.empNo}</span> },
            { term: "이름", desc: <strong className="font-semibold">{op.name}</strong> },
            { term: "성별", desc: op.gender },
            { term: "생년월일", desc: `${op.birthDate} (만 ${age}세)` },
            { term: "본부", desc: op.division },
            { term: "부서", desc: op.department },
            { term: "팀", desc: op.team },
            { term: "직급", desc: op.role },
            {
              term: "상태",
              desc: (
                <span className={`inline-block px-2 py-0.5 text-xs ${statusColor}`}>
                  {statusLabel}
                </span>
              ),
            },
          ]}
        />
      </Section>

      <Divider />

      <Section title="근속 · 계정">
        <DefList
          items={[
            { term: "입사일", desc: op.hiredAt },
            {
              term: "근속",
              desc: (
                <span>
                  {tenure} <span className="text-muted">· {tenureY}년</span>
                </span>
              ),
            },
            { term: "이메일", desc: <span className="font-mono text-xs">{op.email}</span> },
            {
              term: "시스템 권한",
              desc: row.permission ? PERMISSION_LABEL[row.permission] : "-",
            },
            { term: "직급 권한", desc: roleToPermission(op.role) },
            { term: "SSO", desc: "Microsoft Entra · 14일 자동 갱신" },
          ]}
        />
      </Section>

      <Divider />

      <Section title="조직 · 보고 라인">
        <DefList
          items={[
            { term: "소속 팀", desc: `${op.department} · ${op.team}` },
            {
              term: "직속 상사",
              desc: row.leader ? row.leader : leaderOf(op),
            },
            { term: "팀 동료", desc: peersOf(op).join(" · ") || "-" },
          ]}
        />
      </Section>
    </div>
  );
}

function roleToPermission(role: string): string {
  switch (role) {
    case "부장":
      return "L4 관리자 · 전체 권한";
    case "팀장":
      return "L3 팀 관리자 · 팀 전체 권한";
    case "TL":
      return "L2 시니어 · 운영 + 검토";
    case "매니저":
      return "L1 운영자 · 운영 권한";
    default:
      return "L0 일반";
  }
}

function leaderOf(op: { team: string; role: string }): string {
  if (op.role === "부장") return "본부장 (외부)";
  if (op.role === "팀장") {
    const head = OPERATORS.find((x) => x.role === "부장");
    return head ? `${head.name} · ${head.role}` : "-";
  }
  // 매니저/TL → 같은 팀 팀장 또는 부장
  const tl = OPERATORS.find((x) => x.team === op.team && x.role === "팀장");
  if (tl) return `${tl.name} · ${tl.role}`;
  const buchang = OPERATORS.find((x) => x.role === "부장");
  return buchang ? `${buchang.name} · ${buchang.role}` : "-";
}

function peersOf(op: { team: string; email: string }): string[] {
  return OPERATORS.filter((x) => x.team === op.team && x.email !== op.email)
    .slice(0, 3)
    .map((x) => x.name);
}

/* ════════════════════════════════════════════════════════════
   helpers
   ════════════════════════════════════════════════════════════ */
const STATUS_LABEL: Record<ListRow["status"], string> = {
  urgent: "장애",
  active: "활성",
  review: "점검중",
  approved: "정상",
  inactive: "점검중",
  suspended: "정지",
  deleted: "삭제",
};

const STATUS_BADGE: Record<ListRow["status"], string> = {
  urgent: "bg-vermilion text-cream",
  active: "bg-sage/20 text-sage",
  review: "bg-gold/20 text-gold",
  approved: "bg-line-soft text-muted",
  inactive: "bg-gold/20 text-gold",
  suspended: "bg-vermilion/20 text-vermilion",
  deleted: "bg-ink/20 text-ink-soft",
};

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3">
      <h4 className="text-xs font-medium uppercase tracking-[0.12em] text-muted">
        {title}
      </h4>
      {children}
    </section>
  );
}

function DefList({
  items,
}: {
  items: { term: string; desc: React.ReactNode }[];
}) {
  return (
    <dl className="grid grid-cols-[88px_1fr] gap-x-3 gap-y-2 text-sm">
      {items.map((item, i) => (
        <div key={i} className="contents">
          <dt className="text-xs text-muted">{item.term}</dt>
          <dd className="text-ink">{item.desc}</dd>
        </div>
      ))}
    </dl>
  );
}

function Divider() {
  return <div className="border-t border-line" />;
}

const SCHEDULE_TYPE_OPTIONS: {
  value: "shift" | "event" | "leave" | "training";
  label: string;
}[] = [
  { value: "shift", label: "시프트" },
  { value: "event", label: "이벤트" },
  { value: "leave", label: "휴가" },
  { value: "training", label: "교육" },
];

const TODO_PRIORITY_OPTIONS: {
  value: "low" | "medium" | "high";
  label: string;
}[] = [
  { value: "high", label: "높음" },
  { value: "medium", label: "보통" },
  { value: "low", label: "낮음" },
];

/**
 * ISO 8601 (Z) → datetime-local input 형식 ("YYYY-MM-DDTHH:mm") for KST.
 */
function isoToLocalKst(iso?: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  // UTC + 9h shift, then strip 'Z' and seconds.
  const kst = new Date(d.getTime() + 9 * 60 * 60 * 1000);
  return kst.toISOString().slice(0, 16);
}

/**
 * datetime-local input ("YYYY-MM-DDTHH:mm", KST 가정) → ISO 8601 Z.
 */
function localKstToIso(local: string): string {
  if (!local) return "";
  return new Date(`${local}:00+09:00`).toISOString();
}

function ScheduleForm({
  row,
  setRow,
  onSave,
  onCancel,
}: {
  row: ListRow;
  setRow: (next: ListRow) => void;
  onSave: (next: ListRow) => void;
  onCancel: () => void;
}) {
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSave(row);
      }}
      className="space-y-3"
    >
      <label className="block text-xs">
        <span className="mb-1 block text-muted">제목</span>
        <input
          aria-label="제목"
          value={row.name}
          onChange={(e) => setRow({ ...row, name: e.target.value })}
          className="w-full border border-line bg-cream px-2 py-1 text-ink"
          placeholder="일정 제목"
        />
      </label>
      <label className="block text-xs">
        <span className="mb-1 block text-muted">설명</span>
        <textarea
          aria-label="설명"
          value={row.body ?? ""}
          onChange={(e) => setRow({ ...row, body: e.target.value })}
          rows={4}
          className="w-full border border-line bg-cream px-2 py-1 text-ink"
          placeholder="설명 (선택)"
        />
      </label>
      <label className="block text-xs">
        <span className="mb-1 block text-muted">타입</span>
        <select
          aria-label="타입"
          value={row.scheduleType ?? "event"}
          onChange={(e) =>
            setRow({
              ...row,
              scheduleType: e.target.value as ListRow["scheduleType"],
            })
          }
          className="w-full border border-line bg-cream px-2 py-1 text-ink"
        >
          {SCHEDULE_TYPE_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </label>
      <div className="grid grid-cols-2 gap-2">
        <label className="block text-xs">
          <span className="mb-1 block text-muted">시작 (KST)</span>
          <input
            type="datetime-local"
            aria-label="시작"
            value={isoToLocalKst(row.start_at)}
            onChange={(e) =>
              setRow({ ...row, start_at: localKstToIso(e.target.value) })
            }
            className="w-full border border-line bg-cream px-2 py-1 text-ink"
          />
        </label>
        <label className="block text-xs">
          <span className="mb-1 block text-muted">종료 (KST)</span>
          <input
            type="datetime-local"
            aria-label="종료"
            value={isoToLocalKst(row.end_at ?? undefined)}
            onChange={(e) =>
              setRow({
                ...row,
                end_at: e.target.value ? localKstToIso(e.target.value) : null,
              })
            }
            className="w-full border border-line bg-cream px-2 py-1 text-ink"
          />
        </label>
      </div>
      <label className="flex items-center gap-2 text-xs text-ink">
        <input
          type="checkbox"
          aria-label="종일"
          checked={row.allDay ?? false}
          onChange={(e) => setRow({ ...row, allDay: e.target.checked })}
        />
        종일 일정
      </label>
      <label className="block text-xs">
        <span className="mb-1 block text-muted">담당자</span>
        <select
          aria-label="담당자"
          value={row.assigneeEmail ?? ""}
          onChange={(e) =>
            setRow({
              ...row,
              assigneeEmail: e.target.value || null,
              owner: e.target.value
                ? (OPERATORS.find((o) => o.email === e.target.value)?.name ??
                  "")
                : "",
            })
          }
          className="w-full border border-line bg-cream px-2 py-1 text-ink"
        >
          <option value="">팀 공통 (담당자 없음)</option>
          {OPERATORS.map((op) => (
            <option key={op.email} value={op.email}>
              {op.name} · {op.role}
            </option>
          ))}
        </select>
      </label>
      <div className="flex gap-2 pt-2">
        <button
          type="submit"
          className="flex-1 border border-line bg-ink px-3 py-1.5 text-sm font-medium text-cream hover:bg-ink/90"
        >
          저장
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 border border-line bg-transparent px-3 py-1.5 text-sm text-ink hover:bg-washi"
        >
          취소
        </button>
      </div>
      {row.id !== "" && (
        <div className="border-t border-line-soft pt-3">
          <button
            type="button"
            onClick={() => {
              if (
                window.confirm("이 일정을 삭제하시겠습니까? 되돌릴 수 없습니다.")
              ) {
                onSave({ ...row, status: "deleted" });
              }
            }}
            className="w-full border border-vermilion-deep bg-transparent px-3 py-1.5 text-sm text-vermilion-deep hover:bg-vermilion-deep hover:text-cream"
          >
            삭제
          </button>
        </div>
      )}
    </form>
  );
}

function MyTodoForm({
  row,
  setRow,
  onSave,
  onCancel,
}: {
  row: ListRow;
  setRow: (next: ListRow) => void;
  onSave: (next: ListRow) => void;
  onCancel: () => void;
}) {
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSave(row);
      }}
      className="space-y-3"
    >
      <label className="block text-xs">
        <span className="mb-1 block text-muted">제목</span>
        <input
          aria-label="제목"
          value={row.name}
          onChange={(e) => setRow({ ...row, name: e.target.value })}
          className="w-full border border-line bg-cream px-2 py-1 text-ink"
          placeholder="할 일"
        />
      </label>
      <label className="block text-xs">
        <span className="mb-1 block text-muted">내용</span>
        <textarea
          aria-label="내용"
          value={row.body ?? ""}
          onChange={(e) => setRow({ ...row, body: e.target.value })}
          rows={4}
          className="w-full border border-line bg-cream px-2 py-1 text-ink"
          placeholder="설명 (선택)"
        />
      </label>
      <div className="grid grid-cols-2 gap-2">
        <label className="block text-xs">
          <span className="mb-1 block text-muted">우선순위</span>
          <select
            aria-label="우선순위"
            value={row.priority ?? "medium"}
            onChange={(e) =>
              setRow({
                ...row,
                priority: e.target.value as ListRow["priority"],
              })
            }
            className="w-full border border-line bg-cream px-2 py-1 text-ink"
          >
            {TODO_PRIORITY_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-xs">
          <span className="mb-1 block text-muted">마감 (KST, 선택)</span>
          <input
            type="datetime-local"
            aria-label="마감"
            value={isoToLocalKst(row.dueAt ?? undefined)}
            onChange={(e) =>
              setRow({
                ...row,
                dueAt: e.target.value ? localKstToIso(e.target.value) : null,
              })
            }
            className="w-full border border-line bg-cream px-2 py-1 text-ink"
          />
        </label>
      </div>
      <label className="flex items-center gap-2 text-xs text-ink">
        <input
          type="checkbox"
          aria-label="완료"
          checked={row.done ?? false}
          onChange={(e) => {
            const nextDone = e.target.checked;
            setRow({
              ...row,
              done: nextDone,
              doneAt: nextDone ? new Date().toISOString() : null,
            });
          }}
        />
        완료됨
      </label>
      <div className="flex gap-2 pt-2">
        <button
          type="submit"
          className="flex-1 border border-line bg-ink px-3 py-1.5 text-sm font-medium text-cream hover:bg-ink/90"
        >
          저장
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 border border-line bg-transparent px-3 py-1.5 text-sm text-ink hover:bg-washi"
        >
          취소
        </button>
      </div>
      {row.id !== "" && (
        <div className="border-t border-line-soft pt-3">
          <button
            type="button"
            onClick={() => {
              if (window.confirm("이 todo를 삭제하시겠습니까? 되돌릴 수 없습니다.")) {
                onSave({ ...row, status: "deleted" });
              }
            }}
            className="w-full border border-vermilion-deep bg-transparent px-3 py-1.5 text-sm text-vermilion-deep hover:bg-vermilion-deep hover:text-cream"
          >
            삭제
          </button>
        </div>
      )}
    </form>
  );
}

const COHORT_STATUS_OPTIONS: {
  value: "planned" | "in_progress" | "completed";
  label: string;
}[] = [
  { value: "planned", label: "계획" },
  { value: "in_progress", label: "진행중" },
  { value: "completed", label: "완료" },
];

function CohortForm({
  row,
  setRow,
  onSave,
  onCancel,
  onInvite,
}: {
  row: ListRow;
  setRow: (next: ListRow) => void;
  onSave: (next: ListRow) => void;
  onCancel: () => void;
  onInvite?: (id: string) => Promise<{ ok: boolean; error?: string }>;
}) {
  const [inviting, setInviting] = useState(false);
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSave(row);
      }}
      className="space-y-3"
    >
      <label className="block text-xs">
        <span className="mb-1 block text-muted">제목</span>
        <input
          aria-label="제목"
          value={row.name}
          onChange={(e) => setRow({ ...row, name: e.target.value })}
          className="w-full border border-line bg-cream px-2 py-1 text-ink"
          placeholder="회차 제목 (예: 2026 Q2 신입 — 김지나)"
        />
      </label>
      <div className="grid grid-cols-2 gap-2">
        <label className="block text-xs">
          <span className="mb-1 block text-muted">신입</span>
          <select
            aria-label="신입"
            value={row.traineeEmail ?? ""}
            onChange={(e) => {
              const email = e.target.value;
              const op = OPERATORS.find((o) => o.email === email);
              setRow({
                ...row,
                traineeEmail: email,
                author: op?.name ?? email,
              });
            }}
            className="w-full border border-line bg-cream px-2 py-1 text-ink"
          >
            <option value="">선택…</option>
            {OPERATORS.map((op) => (
              <option key={op.email} value={op.email}>
                {op.name} · {op.role}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-xs">
          <span className="mb-1 block text-muted">교육 (선택)</span>
          <select
            aria-label="교육"
            value={row.mentorEmail ?? ""}
            onChange={(e) => {
              const email = e.target.value || null;
              const op = email
                ? OPERATORS.find((o) => o.email === email)
                : null;
              setRow({
                ...row,
                mentorEmail: email,
                owner: op?.name ?? "",
              });
            }}
            className="w-full border border-line bg-cream px-2 py-1 text-ink"
          >
            <option value="">미정</option>
            {OPERATORS.map((op) => (
              <option key={op.email} value={op.email}>
                {op.name} · {op.role}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <label className="block text-xs">
          <span className="mb-1 block text-muted">시작일</span>
          <input
            type="date"
            aria-label="시작일"
            value={row.startDate ?? ""}
            onChange={(e) => setRow({ ...row, startDate: e.target.value })}
            className="w-full border border-line bg-cream px-2 py-1 text-ink"
          />
        </label>
        <label className="block text-xs">
          <span className="mb-1 block text-muted">종료일 (선택)</span>
          <input
            type="date"
            aria-label="종료일"
            value={row.endDate ?? ""}
            onChange={(e) =>
              setRow({ ...row, endDate: e.target.value || null })
            }
            className="w-full border border-line bg-cream px-2 py-1 text-ink"
          />
        </label>
      </div>
      <label className="block text-xs">
        <span className="mb-1 block text-muted">상태</span>
        <select
          aria-label="상태"
          value={row.cohortStatus ?? "planned"}
          onChange={(e) =>
            setRow({
              ...row,
              cohortStatus: e.target.value as ListRow["cohortStatus"],
            })
          }
          className="w-full border border-line bg-cream px-2 py-1 text-ink"
        >
          {COHORT_STATUS_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </label>
      <label className="block text-xs">
        <span className="mb-1 block text-muted">비고</span>
        <textarea
          aria-label="비고"
          value={row.body ?? ""}
          onChange={(e) => setRow({ ...row, body: e.target.value })}
          rows={3}
          className="w-full border border-line bg-cream px-2 py-1 text-ink"
          placeholder="자유 메모"
        />
      </label>
      <div className="flex gap-2 pt-2">
        <button
          type="submit"
          className="flex-1 border border-line bg-ink px-3 py-1.5 text-sm font-medium text-cream hover:bg-ink/90"
        >
          저장
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 border border-line bg-transparent px-3 py-1.5 text-sm text-ink hover:bg-washi"
        >
          취소
        </button>
      </div>
      {row.id !== "" && onInvite && (
        <div className="border-t border-line-soft pt-3">
          <button
            type="button"
            disabled={inviting}
            onClick={async () => {
              if (
                !window.confirm(
                  row.invitedAt
                    ? "다시 초대 메일을 발송하시겠습니까?"
                    : "초대 메일을 발송하시겠습니까?",
                )
              )
                return;
              setInviting(true);
              const result = await onInvite(row.id);
              setInviting(false);
              if (result.ok) {
                alert("초대 메일이 발송되었습니다.");
              } else {
                alert(`발송 실패: ${result.error ?? "알 수 없는 오류"}`);
              }
            }}
            className="w-full border border-vermilion bg-ink px-3 py-1.5 text-sm font-medium text-cream hover:bg-ink/90 disabled:opacity-50"
          >
            {inviting
              ? "발송 중…"
              : row.invitedAt
                ? "재초대 메일 발송"
                : "초대 메일 발송"}
          </button>
        </div>
      )}
      {row.id !== "" && (
        <div className="border-t border-line-soft pt-3">
          <button
            type="button"
            onClick={() => {
              if (
                window.confirm("이 회차를 삭제하시겠습니까? 되돌릴 수 없습니다.")
              ) {
                onSave({ ...row, status: "deleted" });
              }
            }}
            className="w-full border border-vermilion-deep bg-transparent px-3 py-1.5 text-sm text-vermilion-deep hover:bg-vermilion-deep hover:text-cream"
          >
            삭제
          </button>
        </div>
      )}
    </form>
  );
}

function ReceivablesForm({
  row,
  setRow,
  onSave,
  onCancel,
}: {
  row: ListRow;
  setRow: (next: ListRow) => void;
  onSave: (next: ListRow) => void;
  onCancel: () => void;
}) {
  const cells = row.receivablesCells;
  if (!cells) {
    return (
      <p className="text-sm text-muted">편집 가능한 셀 정보가 없습니다.</p>
    );
  }
  const remarksIdx = cells.remarksHeaderIdx;
  const dueDateIdx = cells.dueDateHeaderIdx;
  const schoolOwnerIdx = cells.schoolOwnerHeaderIdx;

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSave(row);
      }}
      className="space-y-3"
    >
      <div className="border border-line-soft bg-washi-raised p-3 text-xs text-muted">
        <p>
          편집 가능:{" "}
          <strong className="text-ink">
            입금예정일 · 적요 · 학교담당자
          </strong>
          . 나머지 셀은 SharePoint 원본 그대로 표시됩니다.
        </p>
      </div>

      <dl className="grid grid-cols-[100px_1fr] gap-x-3 gap-y-2 text-xs">
        {cells.headers.map((h, i) => {
          const isEditable =
            i === remarksIdx || i === dueDateIdx || i === schoolOwnerIdx;
          const value =
            i === remarksIdx
              ? cells.remarks ?? ""
              : i === dueDateIdx
                ? cells.dueDate ?? ""
                : i === schoolOwnerIdx
                  ? cells.schoolOwner ?? ""
                  : cells.textValues[i] ?? "";

          return (
            <div key={i} className="contents">
              <dt className="self-start pt-1 text-muted">{h}</dt>
              <dd>
                {!isEditable ? (
                  <p className="whitespace-pre-wrap pt-1 text-sm text-ink-soft">
                    {value || "—"}
                  </p>
                ) : i === remarksIdx ? (
                  <textarea
                    aria-label={h}
                    value={value}
                    onChange={(e) =>
                      setRow({
                        ...row,
                        receivablesCells: {
                          ...cells,
                          remarks: e.target.value,
                        },
                      })
                    }
                    rows={3}
                    className="w-full border border-line bg-cream px-2 py-1 text-sm text-ink"
                    placeholder="입금완료, 메일 발송 완료 등"
                  />
                ) : i === dueDateIdx ? (
                  <input
                    type="date"
                    aria-label={h}
                    value={toISODateInput(value)}
                    onChange={(e) =>
                      setRow({
                        ...row,
                        receivablesCells: {
                          ...cells,
                          dueDate: e.target.value,
                        },
                      })
                    }
                    className="w-full border border-line bg-cream px-2 py-1 text-sm text-ink"
                  />
                ) : (
                  <div className="space-y-1">
                    <input
                      type="email"
                      aria-label={h}
                      value={value}
                      onChange={(e) =>
                        setRow({
                          ...row,
                          receivablesCells: {
                            ...cells,
                            schoolOwner: e.target.value,
                          },
                        })
                      }
                      className="w-full border border-line bg-cream px-2 py-1 text-sm text-ink"
                      placeholder="manager@school.ac.kr"
                    />
                    {value &&
                    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim()) ? (
                      <p className="text-[11px] text-vermilion-deep">
                        ※ 이메일 형식이 올바르지 않습니다 (저장은 가능)
                      </p>
                    ) : null}
                  </div>
                )}
              </dd>
            </div>
          );
        })}
      </dl>

      <div className="flex gap-2 pt-2">
        <button
          type="submit"
          className="flex-1 border border-line bg-ink px-3 py-1.5 text-sm font-medium text-cream hover:bg-ink/90"
        >
          저장
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 border border-line bg-transparent px-3 py-1.5 text-sm text-ink hover:bg-washi"
        >
          취소
        </button>
      </div>
    </form>
  );
}

function AiWorkView({ row }: { row: ListRow }) {
  const [copied, setCopied] = useState(false);
  const tool = row.aiTool as AiTool | undefined;
  const cat = row.category as AiWorkCategory | undefined;

  const handleCopy = async () => {
    if (!row.reusePrompt) return;
    try {
      await navigator.clipboard.writeText(row.reusePrompt);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className="space-y-5 text-sm text-ink">
      <section className="space-y-1.5">
        <p className="text-2xs uppercase tracking-[0.18em] text-muted">메타</p>
        <div className="flex flex-wrap gap-x-4 gap-y-1.5">
          <span className="text-xs">
            <span className="text-muted">작업일</span>{" "}
            <span className="font-mono text-ink">{row.workDate ?? "—"}</span>
          </span>
          {tool && (
            <span
              className={`inline-block px-2 py-0.5 text-2xs ${AI_TOOL_TONE[tool] ?? ""}`}
            >
              {AI_TOOL_LABEL[tool] ?? tool}
            </span>
          )}
          {cat && (
            <span
              className={`inline-block px-2 py-0.5 text-2xs ${CATEGORY_TONE[cat] ?? ""}`}
            >
              {CATEGORY_LABEL[cat] ?? cat}
            </span>
          )}
          <span className="text-xs">
            <span className="text-muted">등록자</span>{" "}
            <span className="text-ink">{row.owner}</span>
          </span>
          {typeof row.savedHours === "number" && (
            <span className="text-xs">
              <span className="text-muted">절감</span>{" "}
              <span className="font-mono text-ink">{row.savedHours} 시간</span>
            </span>
          )}
        </div>
      </section>

      <section className="space-y-1.5">
        <p className="text-2xs uppercase tracking-[0.18em] text-muted">요약</p>
        <p className="whitespace-pre-wrap text-sm leading-relaxed text-ink">
          {row.summary ?? "요약 없음"}
        </p>
      </section>

      {row.outputUrl && (
        <section className="space-y-1.5">
          <p className="text-2xs uppercase tracking-[0.18em] text-muted">결과물</p>
          <a
            href={row.outputUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block break-all text-xs text-vermilion underline hover:text-vermilion-deep"
          >
            {row.outputUrl}
          </a>
        </section>
      )}

      {row.reusePrompt && (
        <section className="space-y-1.5">
          <div className="flex items-baseline justify-between">
            <p className="text-2xs uppercase tracking-[0.18em] text-muted">
              재사용 프롬프트
            </p>
            <button
              type="button"
              onClick={handleCopy}
              className="border border-line bg-transparent px-2 py-0.5 text-2xs text-ink hover:bg-washi"
            >
              {copied ? "복사됨" : "프롬프트 복사"}
            </button>
          </div>
          <pre className="whitespace-pre-wrap rounded-none border border-line bg-washi-raised px-3 py-2 text-xs leading-relaxed text-ink">
            {row.reusePrompt}
          </pre>
        </section>
      )}

      {row.tags && row.tags.length > 0 && (
        <section className="space-y-1.5">
          <p className="text-2xs uppercase tracking-[0.18em] text-muted">태그</p>
          <div className="flex flex-wrap gap-1.5">
            {row.tags.map((t) => (
              <span
                key={t}
                className="inline-block bg-line-soft px-2 py-0.5 text-2xs text-ink-soft"
              >
                {t}
              </span>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function AiWorkForm({
  row,
  setRow,
  onSave,
  onCancel,
}: {
  row: ListRow;
  setRow: (next: ListRow) => void;
  onSave: (next: ListRow) => void;
  onCancel: () => void;
}) {
  const tagsText = (row.tags ?? []).join(", ");
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSave(row);
      }}
      className="space-y-3"
    >
      {row.owner && (
        <div className="block text-xs">
          <span className="mb-1 block text-muted">등록자</span>
          <p className="border border-line-soft bg-washi-raised px-2 py-1 text-ink">
            {row.owner}
            <span className="ml-1 text-2xs text-muted">(본인 자동 입력)</span>
          </p>
        </div>
      )}
      <label className="block text-xs">
        <span className="mb-1 block text-muted">제목</span>
        <input
          aria-label="제목"
          value={row.name}
          onChange={(e) => setRow({ ...row, name: e.target.value })}
          maxLength={120}
          className="w-full border border-line bg-cream px-2 py-1 text-ink"
          placeholder="예: 회의록 요약 자동화"
        />
      </label>
      <label className="block text-xs">
        <span className="mb-1 block text-muted">작업 일자</span>
        <input
          aria-label="작업 일자"
          type="date"
          value={row.workDate ?? ""}
          onChange={(e) => setRow({ ...row, workDate: e.target.value })}
          className="w-full border border-line bg-cream px-2 py-1 text-ink"
        />
      </label>
      <div className="grid grid-cols-2 gap-3">
        <label className="block text-xs">
          <span className="mb-1 block text-muted">AI 도구</span>
          <select
            aria-label="AI 도구"
            value={row.aiTool ?? ""}
            onChange={(e) => setRow({ ...row, aiTool: e.target.value })}
            className="w-full border border-line bg-cream px-2 py-1 text-ink"
          >
            <option value="">선택…</option>
            {AI_TOOL_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-xs">
          <span className="mb-1 block text-muted">카테고리</span>
          <select
            aria-label="카테고리"
            value={row.category ?? ""}
            onChange={(e) => setRow({ ...row, category: e.target.value })}
            className="w-full border border-line bg-cream px-2 py-1 text-ink"
          >
            <option value="">선택…</option>
            {CATEGORY_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </label>
      </div>
      <label className="block text-xs">
        <span className="mb-1 block text-muted">요약</span>
        <textarea
          aria-label="요약"
          value={row.summary ?? ""}
          onChange={(e) => setRow({ ...row, summary: e.target.value })}
          rows={5}
          className="w-full border border-line bg-cream px-2 py-1 text-ink"
          placeholder="무엇을, 왜, 어떤 결과를 얻었는지 (Markdown 가능)"
        />
      </label>
      <label className="block text-xs">
        <span className="mb-1 block text-muted">결과물 링크</span>
        <input
          aria-label="결과물 링크"
          type="url"
          value={row.outputUrl ?? ""}
          onChange={(e) =>
            setRow({ ...row, outputUrl: e.target.value || null })
          }
          className="w-full border border-line bg-cream px-2 py-1 text-ink"
          placeholder="https://notion.so/... (선택)"
        />
      </label>
      <label className="block text-xs">
        <span className="mb-1 block text-muted">재사용 프롬프트</span>
        <textarea
          aria-label="재사용 프롬프트"
          value={row.reusePrompt ?? ""}
          onChange={(e) =>
            setRow({ ...row, reusePrompt: e.target.value || null })
          }
          rows={6}
          className="w-full border border-line bg-cream px-2 py-1 text-ink"
          placeholder="동료가 복사해서 바로 쓸 수 있는 프롬프트 (선택)"
        />
      </label>
      <div className="grid grid-cols-2 gap-3">
        <label className="block text-xs">
          <span className="mb-1 block text-muted">절감 시간 (시간)</span>
          <input
            aria-label="절감 시간"
            type="number"
            step="0.1"
            min="0"
            value={row.savedHours ?? ""}
            onChange={(e) =>
              setRow({
                ...row,
                savedHours: e.target.value === "" ? null : Number(e.target.value),
              })
            }
            className="w-full border border-line bg-cream px-2 py-1 text-ink"
            placeholder="0.5"
          />
        </label>
        <label className="block text-xs">
          <span className="mb-1 block text-muted">태그 (쉼표 구분)</span>
          <input
            aria-label="태그"
            value={tagsText}
            onChange={(e) =>
              setRow({
                ...row,
                tags: e.target.value
                  .split(",")
                  .map((t) => t.trim())
                  .filter((t) => t.length > 0),
              })
            }
            className="w-full border border-line bg-cream px-2 py-1 text-ink"
            placeholder="회의록, 주간"
          />
        </label>
      </div>
      <div className="flex gap-2 pt-2">
        <button
          type="submit"
          className="flex-1 border border-line bg-ink px-3 py-1.5 text-sm font-medium text-cream hover:bg-ink/90"
        >
          저장
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 border border-line bg-transparent px-3 py-1.5 text-sm text-ink hover:bg-washi"
        >
          취소
        </button>
      </div>
    </form>
  );
}
