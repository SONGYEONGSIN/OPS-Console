import type { ListRow } from "../../../patterns/ListPattern";
import {
  OPERATORS,
  ageOf,
  tenureLabel,
} from "@/features/auth/operators";
import { Section, DefList, Divider } from "../shared";

const COHORT_STATUS_VIEW_LABEL: Record<
  NonNullable<ListRow["cohortStatus"]>,
  { label: string; color: string }
> = {
  planned: { label: "계획", color: "bg-line-soft text-muted" },
  in_progress: { label: "진행중", color: "bg-vermilion text-cream" },
  completed: { label: "완료", color: "bg-washi-raised text-ink" },
};

export function CohortView({ row }: { row: ListRow }) {
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
