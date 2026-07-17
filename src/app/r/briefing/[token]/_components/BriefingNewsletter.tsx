import {
  completionPct,
  eventDateLabel,
  fmtHours,
  fmtViews,
  groupClosingByDate,
  type BriefingPayload,
} from "@/features/automations/jobs/team-briefing-build";
import {
  WizardHatIcon,
  ScrollIcon,
  CalendarIcon,
  AlarmIcon,
  CrystalBallIcon,
  CakeIcon,
  CameraIcon,
  ClapperIcon,
} from "./NewsletterIcons";

/**
 * '운영부 마법사' 주간 뉴스레터 — 스티비 레퍼런스 형식.
 * 제호(마법사 모자 + #001) + 큰 캐치 제목 → 페이지 전체 라인 → 본문(640px).
 * 카드 배경은 nl-ivory 단일 공통색, 액센트는 nl-sky 하나 (팔레트 최소화).
 * 이모지 대신 커스텀 SVG 아이콘. 사진/영상은 Storage 공개 URL(payload.images).
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
    birthdays = [],
    images,
    story,
  } = payload;
  const totalAll = contracts.totalDone + contracts.totalOngoing;
  const totalPct = completionPct(contracts.totalDone, contracts.totalOngoing);
  const issueLabel = `#${String(issueNo).padStart(3, "0")}`;
  const hasCelebration = milestones.length > 0 || birthdays.length > 0;

  return (
    <div className="text-nl-ink">
      {/* ── 제호 — 아래 페이지 전체 라인으로 본문과 구분 ── */}
      <header className="border-b-2 border-nl-sky">
        <div className="mx-auto max-w-[640px] px-5 pb-8 pt-10">
          <div className="flex items-center gap-3">
            <span className="flex h-14 w-14 flex-none items-center justify-center rounded-full bg-nl-sky text-white">
              <WizardHatIcon className="h-8 w-8" />
            </span>
            <div className="min-w-0">
              <p className="text-lg font-bold">운영부 마법사</p>
              <p className="text-sm text-nl-muted">
                주간 뉴스레터 · {dateLabel} 발행
              </p>
            </div>
            <span className="ml-auto flex-none rounded-full bg-nl-sky px-3.5 py-1.5 text-sm font-bold tabular-nums text-white">
              {issueLabel}
            </span>
          </div>

          <h1 className="mt-8 text-[34px] font-bold leading-[1.3]">
            {story?.headline ?? `운영부 주간 뉴스레터 ${issueLabel}`}
          </h1>
          {story?.intro && (
            <p className="mt-4 text-[16px] leading-[1.85]">{story.intro}</p>
          )}
        </div>
      </header>

      <article className="mx-auto max-w-[640px] px-5 pb-12 pt-9">
        {/* 커버 사진 */}
        {images?.cover && (
          <figure className="mb-9">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={images.cover.src}
              alt={images.cover.caption ?? "이번 주 운영부"}
              className="w-full rounded-[13px]"
            />
            {images.cover.caption && (
              <figcaption className="mt-2 text-center text-xs text-nl-muted">
                {images.cover.caption}
              </figcaption>
            )}
          </figure>
        )}

        <div className="space-y-10">
          {/* ── 기념일 — 생일 + 근속 (있을 때만) ─────────── */}
          {hasCelebration && (
            <section className="rounded-[13px] bg-nl-ivory p-6">
              <h2 className="flex items-center gap-2 text-lg font-bold">
                <CakeIcon className="h-6 w-6 text-nl-sky" />
                이번 주의 기념일
              </h2>
              <ul className="mt-3 space-y-1.5">
                {birthdays.map((b) => (
                  <li
                    key={`bd-${b.name}-${b.dateYmd}`}
                    className="text-[15px] leading-[1.8]"
                  >
                    <b>{b.name}</b>님의{" "}
                    <b className="text-nl-sky">생일</b>이{" "}
                    {b.dateYmd.slice(5).replace("-", "/")}에 있어요 —
                    축하해주세요 🎈
                  </li>
                ))}
                {milestones.map((m) => (
                  <li
                    key={`ms-${m.name}-${m.dateYmd}`}
                    className="text-[15px] leading-[1.8]"
                  >
                    <b>{m.name}</b>님이 {m.dateYmd.slice(5).replace("-", "/")}에{" "}
                    <b className="text-nl-sky">입사 {m.years}주년</b>을 맞아요 —
                    축하해주세요 👏
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* ── 계약 이야기 ──────────────────────────────── */}
          <Section
            icon={<ScrollIcon className="h-6 w-6 text-nl-sky" />}
            title="계약 이야기"
          >
            {story?.sections.contracts && (
              <Story>{story.sections.contracts}</Story>
            )}
            <Card>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-nl-sky-soft text-left text-xs text-nl-ink">
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
                    style={{
                      width: `${(contracts.totalDone / totalAll) * 100}%`,
                    }}
                  />
                </div>
              )}
            </Card>
          </Section>

          {/* ── 차주 업무 이야기 ─────────────────────────── */}
          <Section
            icon={<CalendarIcon className="h-6 w-6 text-nl-sky" />}
            title="차주 업무 이야기"
            meta={`${weekRange.startYmd} ~ ${weekRange.endYmd}`}
          >
            {story?.sections.schedule && (
              <Story>{story.sections.schedule}</Story>
            )}
            <Card>
              {schedule.length === 0 ? (
                <Empty>예정된 일정 없음</Empty>
              ) : (
                <ul className="space-y-2">
                  {schedule.map((g) => (
                    <li key={g.type} className="flex items-start gap-2 text-sm">
                      <span className="mt-0.5 inline-block flex-none rounded-full bg-white px-2.5 py-0.5 text-xs font-bold text-nl-sky">
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
            </Card>
          </Section>

          {/* ── 마감 이야기 ──────────────────────────────── */}
          <Section
            icon={<AlarmIcon className="h-6 w-6 text-nl-sky" />}
            title={`마감 이야기 · 7일 내 ${closing.length}건`}
          >
            {story?.sections.closing && <Story>{story.sections.closing}</Story>}
            <Card>
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
            </Card>
          </Section>

          {/* ── AI 이야기 ────────────────────────────────── */}
          <Section
            icon={<CrystalBallIcon className="h-6 w-6 text-nl-sky" />}
            title="AI 이야기 · 최근 7일"
          >
            {story?.sections.ai && <Story>{story.sections.ai}</Story>}
            <div className="space-y-3">
              <Card>
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
              </Card>

              <Card>
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
              </Card>

              <Card>
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
                          className="font-medium underline decoration-nl-sky decoration-2 underline-offset-2 hover:text-nl-sky"
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
              </Card>
            </div>
          </Section>

          {/* ── 이번 주 앨범 (사진 있을 때만) ─────────────── */}
          {images?.gallery && images.gallery.length > 0 && (
            <Section
              icon={<CameraIcon className="h-6 w-6 text-nl-sky" />}
              title="이번 주 앨범"
            >
              <div className="grid grid-cols-2 gap-3">
                {images.gallery.map((g, i) => (
                  <figure key={i}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={g.src}
                      alt={g.caption ?? `앨범 사진 ${i + 1}`}
                      loading="lazy"
                      className="aspect-square w-full rounded-[13px] object-cover"
                    />
                    {g.caption && (
                      <figcaption className="mt-1.5 text-center text-xs text-nl-muted">
                        {g.caption}
                      </figcaption>
                    )}
                  </figure>
                ))}
              </div>
            </Section>
          )}

          {/* ── 이번 주 영상 (있을 때만) ──────────────────── */}
          {images?.videos && images.videos.length > 0 && (
            <Section
              icon={<ClapperIcon className="h-6 w-6 text-nl-sky" />}
              title="이번 주 영상"
            >
              {images.videos.map((v, i) => (
                <figure key={i}>
                  <video
                    src={v.src}
                    controls
                    preload="metadata"
                    className="w-full rounded-[13px]"
                  />
                  {v.caption && (
                    <figcaption className="mt-1.5 text-center text-xs text-nl-muted">
                      {v.caption}
                    </figcaption>
                  )}
                </figure>
              ))}
            </Section>
          )}
        </div>

        {/* ── 푸터 ─────────────────────────────────────── */}
        <hr className="mt-12 border-0 border-t border-nl-sky-soft" />
        <footer className="py-6 text-center text-xs leading-[1.9] text-nl-muted">
          <p>
            매주 금요일 10:00, 운영부 마법사가 한 주를 모아 전해드립니다 📮
            <br />
            [운영부 상황실] OPS Console · 피드백은 개선요청 메뉴로 남겨주세요.
          </p>
        </footer>
      </article>
    </div>
  );
}

/** 섹션 — 커스텀 아이콘 + 제목(+메타), 아래 스토리 문단과 카드. */
function Section({
  icon,
  title,
  meta,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  meta?: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-lg font-bold">
          {icon}
          {title}
        </h2>
        {meta && <span className="text-xs text-nl-muted">{meta}</span>}
      </div>
      <div className="mt-3 space-y-3">{children}</div>
    </section>
  );
}

/** 데이터 카드 — 공통 배경 nl-ivory 하나로 통일 (팔레트 최소화). */
function Card({ children }: { children: React.ReactNode }) {
  return <div className="rounded-[13px] bg-nl-ivory p-5">{children}</div>;
}

/** claude -p 생성 스토리 문단. */
function Story({ children }: { children: React.ReactNode }) {
  return <p className="text-[15px] leading-[1.85]">{children}</p>;
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-nl-muted">{children}</p>;
}
