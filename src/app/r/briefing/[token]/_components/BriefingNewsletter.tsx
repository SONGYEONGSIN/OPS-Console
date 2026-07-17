import {
  completionPct,
  eventDateLabel,
  fmtHours,
  fmtViews,
  groupClosingByDate,
  type BriefingPayload,
} from "@/features/automations/jobs/team-briefing-build";

/**
 * 팀 브리핑 뉴스레터 — 스티비 레퍼런스(dragonmamaclub) 충실 클론 스킨.
 * 흰 바탕 단일 컬럼(640px), 원형 프로필 제호, 캐치 headline, 이모지 섹션 +
 * 파스텔(하늘/분홍/아이보리) 13px 라운드 박스, 스토리 문단(claude -p 생성) + 데이터.
 * 서버 컴포넌트(훅 없음) — /r/briefing/[token] 게스트 view.
 */
export function BriefingNewsletter({
  issueNo,
  payload,
}: {
  issueNo: number;
  payload: BriefingPayload;
}) {
  const {
    dateLabel,
    contracts,
    weekRange,
    schedule,
    closing,
    aiWork,
    tips,
    insights,
    milestones = [],
    story,
  } = payload;
  const totalAll = contracts.totalDone + contracts.totalOngoing;
  const totalPct = completionPct(contracts.totalDone, contracts.totalOngoing);

  return (
    <article className="mx-auto max-w-[640px] px-5 py-10 text-nl-ink">
      {/* ── 제호 — 원형 프로필 + 발행 정보 ─────────────── */}
      <header>
        <div className="flex items-center gap-3">
          {/* 스티비의 원형 프로필 자리 — 브랜드 마크 원형 */}
          <span className="flex h-12 w-12 flex-none items-center justify-center rounded-full bg-nl-sky font-mono text-lg font-bold text-white">
            &gt;_
          </span>
          <div className="min-w-0">
            <p className="text-sm font-bold">운영부 상황실</p>
            <p className="text-xs text-nl-muted">
              주간 브리핑 · {dateLabel} 발행
            </p>
          </div>
          <span className="ml-auto flex-none rounded-full bg-nl-sky px-3 py-1 text-xs font-bold text-white">
            #{issueNo}
          </span>
        </div>

        <h1 className="mt-7 text-[26px] font-bold leading-[1.35]">
          {story?.headline ?? `운영부 주간 브리핑 #${issueNo}`}
        </h1>
        {story?.intro && (
          <p className="mt-3 text-[15px] leading-[1.8] text-nl-ink">
            {story.intro}
          </p>
        )}
      </header>

      <hr className="my-8 border-0 border-t border-nl-sky-soft" />

      <div className="space-y-9">
        {/* ── 🎂 근속 기념일 (있을 때만, 맨 위 축하) ────── */}
        {milestones.length > 0 && (
          <section className="rounded-[13px] bg-nl-pink-soft p-5">
            <h2 className="text-base font-bold">
              <span aria-hidden className="mr-1.5">
                🎂
              </span>
              이번 주의 기념일
            </h2>
            <ul className="mt-2 space-y-1">
              {milestones.map((m) => (
                <li key={`${m.name}-${m.dateYmd}`} className="text-sm leading-[1.8]">
                  <b>{m.name}</b>님이 {m.dateYmd.slice(5).replace("-", "/")}에{" "}
                  <b className="text-nl-sky">입사 {m.years}주년</b>을 맞아요 —
                  축하해주세요 👏
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* ── 📌 계약 이야기 ────────────────────────────── */}
        <Section emoji="📌" title="계약 이야기">
          {story?.sections.contracts && <Story>{story.sections.contracts}</Story>}
          <div className="rounded-[13px] bg-nl-ivory p-5">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-nl-sky-soft text-left text-xs text-nl-muted">
                  <th className="py-1.5 pr-2 font-medium">시트</th>
                  <th className="py-1.5 pr-2 text-right font-medium">총</th>
                  <th className="py-1.5 pr-2 text-right font-medium">완료</th>
                  <th className="py-1.5 pr-2 text-right font-medium">진행중</th>
                  <th className="py-1.5 text-right font-medium">완료율</th>
                </tr>
              </thead>
              <tbody>
                {contracts.bySheet.map((s) => (
                  <tr key={s.sheet}>
                    <td className="py-1.5 pr-2">{s.sheet}</td>
                    <td className="py-1.5 pr-2 text-right tabular-nums">
                      {s.done + s.ongoing}
                    </td>
                    <td className="py-1.5 pr-2 text-right tabular-nums">
                      {s.done}
                    </td>
                    <td className="py-1.5 pr-2 text-right tabular-nums">
                      {s.ongoing}
                    </td>
                    <td className="py-1.5 text-right tabular-nums">
                      {completionPct(s.done, s.ongoing)}
                    </td>
                  </tr>
                ))}
                <tr className="border-t border-nl-sky-soft font-bold">
                  <td className="py-2 pr-2">합계</td>
                  <td className="py-2 pr-2 text-right tabular-nums">
                    {totalAll}
                  </td>
                  <td className="py-2 pr-2 text-right tabular-nums">
                    {contracts.totalDone}
                  </td>
                  <td className="py-2 pr-2 text-right tabular-nums">
                    {contracts.totalOngoing}
                  </td>
                  <td className="py-2 text-right tabular-nums text-nl-sky">
                    {totalPct}
                  </td>
                </tr>
              </tbody>
            </table>
            {totalAll > 0 && (
              <div
                role="img"
                aria-label={`전체 완료율 ${totalPct}`}
                className="mt-3 h-2 w-full overflow-hidden rounded-full bg-white"
              >
                <div
                  className="h-full rounded-full bg-nl-sky"
                  style={{ width: `${(contracts.totalDone / totalAll) * 100}%` }}
                />
              </div>
            )}
          </div>
        </Section>

        {/* ── 🗓 차주 업무 이야기 ───────────────────────── */}
        <Section
          emoji="🗓"
          title="차주 업무 이야기"
          meta={`${weekRange.startYmd} ~ ${weekRange.endYmd}`}
        >
          {story?.sections.schedule && <Story>{story.sections.schedule}</Story>}
          <div className="rounded-[13px] bg-nl-sky-soft p-5">
            {schedule.length === 0 ? (
              <Empty>예정된 일정 없음</Empty>
            ) : (
              <ul className="space-y-2">
                {schedule.map((g) => (
                  <li key={g.type} className="flex items-start gap-2 text-sm">
                    <span className="mt-0.5 inline-block flex-none rounded-full bg-white px-2 py-0.5 text-xs font-bold text-nl-sky">
                      {g.label}
                    </span>
                    <span className="min-w-0 leading-[1.7]">
                      {g.items
                        .map((i) => `${i.title} (${eventDateLabel(i)})`)
                        .join(", ")}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Section>

        {/* ── ⏰ 마감 이야기 ─────────────────────────────── */}
        <Section emoji="⏰" title={`마감 이야기 · 7일 내 ${closing.length}건`}>
          {story?.sections.closing && <Story>{story.sections.closing}</Story>}
          <div className="rounded-[13px] bg-nl-pink-soft p-5">
            {closing.length === 0 ? (
              <Empty>임박한 마감 없음</Empty>
            ) : (
              <div className="space-y-3">
                {groupClosingByDate(closing).map((g) => (
                  <div key={g.date}>
                    <p className="text-xs font-bold text-nl-sky">
                      {g.date.slice(5).replace("-", "/")} · {g.items.length}건
                    </p>
                    <ul className="mt-1 space-y-1">
                      {g.items.slice(0, 10).map((u, i) => (
                        <li key={i} className="text-sm leading-[1.7]">
                          {u.university_name} {u.service_name}
                          {u.operator_name ? (
                            <span className="text-nl-muted">
                              {" "}
                              · {u.operator_name}
                            </span>
                          ) : null}
                        </li>
                      ))}
                      {g.items.length > 10 && (
                        <li className="text-xs text-nl-muted">
                          외 {g.items.length - 10}건
                        </li>
                      )}
                    </ul>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Section>

        {/* ── 🤖 AI 이야기 ──────────────────────────────── */}
        <Section emoji="🤖" title="AI 이야기 · 최근 7일">
          {story?.sections.ai && <Story>{story.sections.ai}</Story>}
          <div className="space-y-3">
            <div className="rounded-[13px] bg-nl-ivory p-5">
              <h3 className="text-sm font-bold">
                내 AI 작업 {aiWork.count}건
                {aiWork.savedHours > 0
                  ? ` · 절감 ${fmtHours(aiWork.savedHours)}h`
                  : ""}
              </h3>
              {aiWork.count === 0 ? (
                <div className="mt-1.5">
                  <Empty>등록된 AI 작업 없음</Empty>
                </div>
              ) : (
                <ul className="mt-1.5 space-y-1">
                  {aiWork.items.map((w, i) => (
                    <li key={i} className="text-sm leading-[1.7]">
                      {w.title}
                      <span className="text-nl-muted">
                        {" "}
                        · {w.ai_tool} · {w.author_name}
                        {w.saved_hours != null
                          ? ` · ${fmtHours(w.saved_hours)}h`
                          : ""}
                      </span>
                    </li>
                  ))}
                  {aiWork.more > 0 && (
                    <li className="text-xs text-nl-muted">
                      외 {aiWork.more}건
                    </li>
                  )}
                </ul>
              )}
            </div>

            <div className="rounded-[13px] bg-nl-ivory p-5">
              <h3 className="text-sm font-bold">
                TIP 공유 · 신규 {tips.newCount} / 누적 {tips.totalCount}
              </h3>
              {tips.newCount === 0 ? (
                <div className="mt-1.5">
                  <Empty>신규 TIP 없음</Empty>
                </div>
              ) : (
                <ul className="mt-1.5 space-y-1">
                  {tips.items.map((t, i) => (
                    <li key={i} className="text-sm leading-[1.7]">
                      {t.title}
                      <span className="text-nl-muted">
                        {" "}
                        · {t.ai_tool} · {t.author_name}
                      </span>
                    </li>
                  ))}
                  {tips.more > 0 && (
                    <li className="text-xs text-nl-muted">외 {tips.more}건</li>
                  )}
                </ul>
              )}
            </div>

            <div className="rounded-[13px] bg-nl-sky-soft p-5">
              <h3 className="text-sm font-bold">
                AI 인사이트 · 신규 수집 {insights.newCount}건
              </h3>
              {insights.newCount === 0 ? (
                <div className="mt-1.5">
                  <Empty>신규 수집 영상 없음</Empty>
                </div>
              ) : (
                <ul className="mt-1.5 space-y-1">
                  {insights.items.map((v, i) => (
                    <li key={i} className="text-sm leading-[1.7]">
                      <a
                        href={v.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-medium text-nl-ink underline decoration-nl-sky decoration-2 underline-offset-2 hover:text-nl-sky"
                      >
                        {v.title}
                      </a>
                      <span className="text-nl-muted">
                        {" "}
                        · {v.channel_title}
                        {v.view_count != null
                          ? ` · 조회 ${fmtViews(v.view_count)}`
                          : ""}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </Section>
      </div>

      {/* ── 푸터 ─────────────────────────────────────── */}
      <hr className="mt-10 border-0 border-t border-nl-sky-soft" />
      <footer className="py-6 text-center text-xs leading-[1.9] text-nl-muted">
        <p>
          매주 금요일 10:00, 운영부의 한 주를 모아 전해드립니다 📮
          <br />
          [운영부 상황실] OPS Console · 피드백은 개선요청 메뉴로 남겨주세요.
        </p>
        <p className="mt-2">
          링크를 아는 사람만 열람할 수 있는 공유 페이지입니다.
        </p>
      </footer>
    </article>
  );
}

/** 이모지 섹션 — 제목(+메타) 아래 스토리 문단과 파스텔 박스가 이어진다. */
function Section({
  emoji,
  title,
  meta,
  children,
}: {
  emoji: string;
  title: string;
  meta?: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-lg font-bold">
          <span aria-hidden className="mr-1.5">
            {emoji}
          </span>
          {title}
        </h2>
        {meta && <span className="text-xs text-nl-muted">{meta}</span>}
      </div>
      <div className="mt-3 space-y-3">{children}</div>
    </section>
  );
}

/** claude -p 생성 스토리 문단. */
function Story({ children }: { children: React.ReactNode }) {
  return <p className="text-[15px] leading-[1.8]">{children}</p>;
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-nl-muted">{children}</p>;
}
