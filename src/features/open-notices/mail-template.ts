import { kstFormat } from "@/lib/kst-format";

/**
 * 오픈안내 메일 초안. 운영자가 검토·편집해서 발송한다.
 *
 * 값을 만들어 넣는 칸은 넷이고 그중 둘이 조립 URL이다 — 손으로 옮기면
 * 틀리고, 틀린 링크는 대학이 접수 기간 내내 경쟁률을 못 보는 것으로 이어진다.
 */

/** 접수관리자 로그인 — 접수구분과 무관하게 한 곳. */
const ADMIN_URL = "https://nadmin.jinhakapply.com/Login.aspx";
/** 고객센터 */
const CALL_CENTER = "1544-7715";
/** 경쟁률 HTML 이 놓이는 자리 (scripts/moa-ratio/audit.py 의 REAL 베이스와 같다) */
const RATIO_BASE = "https://addon.jinhakapply.com/RatioV1/RatioH";
/**
 * 경쟁률 차수. 대부분 1차뿐이고 2차수 이상은 운영자가 본문을 고친다 —
 * closing_services 에 차수 컬럼이 없어 서버가 알 방법이 없다.
 */
const RATIO_SEQ = 1;

const DIVIDER = "────────────────────────────────";

type PartMap = Record<string, string>;

/** KST 연·월·일·요일·시·분을 조각으로 뽑는다. */
function kstParts(iso: string): PartMap {
  const parts = kstFormat({
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).formatToParts(new Date(iso));
  const out: PartMap = {};
  for (const p of parts) out[p.type] = p.value;
  return out;
}

/**
 * 접수기간 한 줄. `2026.09.08(화) 10:00 ~ 09.11(금) 18:00`
 *
 * **종료 연도는 시작과 같은 해일 때만 생략한다.** 실데이터에 종료가 1년 뒤로
 * 적힌 건이 7개 있다(건국대·경상국립대 등). 늘 생략하면 그 건들이
 * `2026.09.07 ~ 09.11` 로 멀쩡해 보여서 1년 틀린 기간이 대학에 발송된다.
 * 연도를 찍으면 `~ 2027.09.11` 이 눈에 걸린다.
 */
export function formatApplyPeriod(
  startIso: string | null | undefined,
  endIso: string | null | undefined,
): string {
  if (!startIso || !endIso) return "";
  const s = kstParts(startIso);
  const e = kstParts(endIso);
  if (!s.year || !e.year) return "";

  const start = `${s.year}.${s.month}.${s.day}(${s.weekday}) ${s.hour}:${s.minute}`;
  const endHead = s.year === e.year ? `${e.month}.${e.day}` : `${e.year}.${e.month}.${e.day}`;
  return `${start} ~ ${endHead}(${e.weekday}) ${e.hour}:${e.minute}`;
}

/**
 * 원서접수 안내 페이지 주소.
 *
 * 접수구분이 호스트를 정한다 — `entertest/target-url.ts` 가 테스트 시스템에서
 * 하는 분기와 같은 규칙이고, 비어 있으면 다수(반응형원서) 쪽으로 둔다.
 * **그 함수와 합치지 않는다** — 테스트 호스트가 바뀌어도 대학에 나가는
 * 메일은 그대로여야 한다.
 */
export function applyNoticeUrl(
  serviceId: number,
  admissionType: string | null | undefined,
): string {
  const host =
    admissionType?.trim() === "공통원서"
      ? "apply.jinhakapply.com"
      : "enter.jinhakapply.com";
  return `https://${host}/Notice/${serviceId}/A`;
}

/** 경쟁률 공개 페이지 주소. 차수는 1 고정. */
export function ratioUrl(serviceId: number): string {
  return `${RATIO_BASE}/Ratio${serviceId}${RATIO_SEQ}.html`;
}

export type OpenNoticeTemplateArgs = {
  operatorName: string;
  universityName: string;
  /** closing_services.service_name — 그대로 '모집구분' 이 된다 */
  serviceName: string;
  serviceId: number;
  admissionType: string | null | undefined;
  writeStartAt: string | null | undefined;
  writeEndAt: string | null | undefined;
};

/** 오픈안내 평문 기본값 (제목 + 본문). 운영자가 검토·편집 후 발송. */
export function buildDefaultOpenNoticeText(args: OpenNoticeTemplateArgs): {
  subject: string;
  body: string;
} {
  const {
    operatorName,
    universityName,
    serviceName,
    serviceId,
    admissionType,
    writeStartAt,
    writeEndAt,
  } = args;

  const subject = `[진학어플라이] ${universityName} ${serviceName} 인터넷 원서접수 오픈 안내`;

  const lines = [
    "안녕하세요.",
    `진학어플라이 ${operatorName}입니다.`,
    "",
    `${universityName} ${serviceName} 인터넷 원서접수 페이지가`,
    "아래와 같이 오픈되었음을 안내드립니다.",
    "",
    "■ 오픈 정보",
    DIVIDER,
    `· 대학명   : ${universityName}`,
    `· 모집구분 : ${serviceName}`,
    // 기간을 못 만들어도 칸은 남긴다 — 줄이 없으면 누락을 못 알아챈다.
    `· 접수기간 : ${formatApplyPeriod(writeStartAt, writeEndAt)}`,
    `· 접수주소 : ${applyNoticeUrl(serviceId, admissionType)}`,
    "",
    "■ 접수기간 중 운영 안내",
    DIVIDER,
    `· 접수관리자  : ${ADMIN_URL}`,
    "   └ 접수현황·경쟁률 실시간 조회",
    `· 경쟁률 공개 : ${ratioUrl(serviceId)}`,
    "   └ 지원자 경쟁률 실시간 조회",
    `· 지원자 문의 : 진학어플라이 고객센터 ${CALL_CENTER}`,
    "   └ 평일 09:00~18:00 (마감일 ~22:00 연장 운영)",
    "",
    "문의사항은 아래 연락처로 연락 주시기 바랍니다.",
    "감사합니다.",
  ];

  return { subject, body: lines.join("\n") };
}
