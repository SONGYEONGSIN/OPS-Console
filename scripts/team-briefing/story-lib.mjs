// 주간 브리핑 뉴스레터 스토리 — claude -p 프롬프트/파싱/폴백 (순수 함수, vitest 대상).
// 실행 흐름은 publish-local.mjs 참조.

/** 완료율 문자열 — team-briefing-build completionPct와 동일 규칙. */
function pct(done, ongoing) {
  const total = done + ongoing;
  if (total === 0) return "—";
  return `${((done / total) * 100).toFixed(1)}%`;
}

function mmdd(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d
    .toLocaleDateString("en-CA", { timeZone: "Asia/Seoul" })
    .slice(5);
}

/** payload → claude -p 프롬프트. JSON only 응답을 강제한다. */
export function buildStoryPrompt(payload, issueNo) {
  const c = payload.contracts;
  const totalAll = c.totalDone + c.totalOngoing;
  const sheets = c.bySheet
    .map((s) => `${s.sheet} 완료 ${s.done}/진행 ${s.ongoing}`)
    .join(", ");

  const scheduleLine =
    payload.schedule.length === 0
      ? "없음"
      : payload.schedule
          .map(
            (g) =>
              `[${g.label}] ` +
              g.items.map((i) => `${i.title}(${mmdd(i.start_at)})`).join(", "),
          )
          .join(" / ");

  const closingLine =
    payload.closing.length === 0
      ? "없음"
      : `${payload.closing.length}건 — ` +
        payload.closing
          .slice(0, 10)
          .map(
            (u) =>
              `${mmdd(u.pay_end_at)} ${u.university_name} ${u.service_name}${u.operator_name ? `(${u.operator_name})` : ""}`,
          )
          .join(", ");

  const aiLine =
    `작업 ${payload.aiWork.count}건(절감 ${payload.aiWork.savedHours}h): ` +
    (payload.aiWork.items
      .map((w) => `${w.title}(${w.ai_tool}·${w.author_name})`)
      .join(", ") || "없음") +
    ` / TIP 신규 ${payload.tips.newCount}(누적 ${payload.tips.totalCount}): ` +
    (payload.tips.items.map((t) => t.title).join(", ") || "없음") +
    ` / 인사이트 ${payload.insights.newCount}건: ` +
    (payload.insights.items
      .map((v) => `${v.title}(${v.channel_title})`)
      .join(", ") || "없음");

  const milestoneLine =
    (payload.milestones ?? []).length === 0
      ? "없음"
      : payload.milestones
          .map((m) => `${m.name} ${m.years}주년(${m.dateYmd.slice(5)})`)
          .join(", ");

  const birthdayLine =
    (payload.birthdays ?? []).length === 0
      ? "없음"
      : payload.birthdays
          .map((b) => `${b.name}(${b.dateYmd.slice(5)})`)
          .join(", ");

  return `당신은 사내 뉴스레터 '운영부 마법사'의 편집자입니다. 아래 주간 데이터를 바탕으로 스티비 뉴스레터 스타일의 밝고 친근한 한국어 문구를 작성하세요.

팀 컨텍스트:
- 우리 팀(운영부)의 주 업무는 대학 입시 원서접수와 PIMS 운영입니다.
- 운영부 달력에는 근무·원서접수·PIMS·외부회의·교육·휴가 일정이 올라옵니다 — 사내 교육 일정도 팀 업무 맥락으로 자연스럽게 다뤄주세요.
- 독자는 입사 1년 차부터 10년 차까지의 운영부 동료 전원입니다. 쉬운 표현, 존댓말.

규칙:
- 반드시 아래 형식의 JSON만 출력하세요 (설명·코드펜스 금지):
{"headline": "...", "intro": "...", "sections": {"contracts": "...", "schedule": "...", "closing": "...", "ai": "..."}}
- headline: 독자의 관심을 끄는 한 줄 제목 (25자 내외, 핵심 수치 1개 포함, 이모지 최대 1개)
- intro: 인사 + 이번 호 핵심 요약 2문장
- 각 sections 값: 해당 카테고리를 2~3문장의 짧은 이야기로. 수치는 자연스럽게 녹이고, 데이터에 없는 사실을 지어내지 마세요.
- 생일·근속 기념일이 있으면 intro에 자연스럽게 축하를 담으세요.
- schedule 이야기는 휴가에만 쏠리지 말고, 근무·원서접수·PIMS·교육·일반 일정(비용 처리 등)도 있으면 골고루 다루세요.

[주간 데이터 — 제${issueNo}호 · ${payload.dateLabel} 발행]
- 계약(누적): 총 ${totalAll} · 완료 ${c.totalDone} · 진행중 ${c.totalOngoing} (완료율 ${pct(c.totalDone, c.totalOngoing)}) / 시트별: ${sheets}
- 차주 일정(${payload.weekRange.startYmd}~${payload.weekRange.endYmd}): ${scheduleLine}
- 마감 임박(7일 내): ${closingLine}
- AI 활용(최근 7일): ${aiLine}
- 근속 기념일(발행 주): ${milestoneLine}
- 생일(발행 주): ${birthdayLine}`;
}

/** claude 응답 텍스트 → BriefingStory | null. 코드펜스/전후 텍스트 허용. */
export function parseStoryJson(text) {
  if (typeof text !== "string") return null;
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  let obj;
  try {
    obj = JSON.parse(text.slice(start, end + 1));
  } catch {
    return null;
  }
  const s = obj?.sections;
  const isStr = (v) => typeof v === "string" && v.length > 0;
  if (
    !isStr(obj?.headline) ||
    !isStr(obj?.intro) ||
    !s ||
    !isStr(s.contracts) ||
    !isStr(s.schedule) ||
    !isStr(s.closing) ||
    !isStr(s.ai)
  ) {
    return null;
  }
  return {
    headline: obj.headline,
    intro: obj.intro,
    sections: {
      contracts: s.contracts,
      schedule: s.schedule,
      closing: s.closing,
      ai: s.ai,
    },
  };
}

/** claude 실패 시 수치 요약 폴백 — 발행은 항상 성공하도록 (선택 스펙). */
export function fallbackStory(payload) {
  const c = payload.contracts;
  return {
    headline: `이번 주 운영부 — 계약 완료 ${c.totalDone}건 (${pct(c.totalDone, c.totalOngoing)})`,
    intro: "이번 주 운영부 주요 현황을 전해드립니다.",
    sections: {
      contracts: `누적 계약 완료 ${c.totalDone}건, 진행중 ${c.totalOngoing}건으로 완료율 ${pct(c.totalDone, c.totalOngoing)}입니다.`,
      schedule:
        payload.schedule.length === 0
          ? "차주에 예정된 팀 일정은 없습니다."
          : `차주(${payload.weekRange.startYmd}~${payload.weekRange.endYmd})에 ${payload.schedule.length}개 유형의 일정이 있습니다.`,
      closing:
        payload.closing.length === 0
          ? "7일 내 임박한 서비스 마감은 없습니다."
          : `7일 내 마감 임박 서비스가 ${payload.closing.length}건 있습니다. 담당 서비스를 확인해주세요.`,
      ai: `최근 7일 AI 작업 ${payload.aiWork.count}건(절감 ${payload.aiWork.savedHours}h), 신규 TIP ${payload.tips.newCount}건이 등록됐습니다.`,
    },
  };
}
