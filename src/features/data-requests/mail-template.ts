/**
 * 작년 접수 시작일(YYYY.MM.DD) 기준 -7일을 'M월 D일'로 반환 — 회신 기한 제안값.
 * (올해 접수 시작일 데이터가 없어 작년 시작일의 월·일을 기준으로 삼는다. 운영자 편집 전제)
 */
function reminderDeadline(writeStart: string): string {
  const m = writeStart.match(/^(\d{4})\.(\d{1,2})\.(\d{1,2})/);
  if (!m) return "";
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  d.setDate(d.getDate() - 7);
  return `${d.getMonth() + 1}월 ${d.getDate()}일`;
}

/** 진학어플라이 자료요청 평문 기본값 생성 (제목 + 본문). 운영자가 검토·편집 후 발송. */
export function buildDefaultDataRequestText(args: {
  operatorName: string;
  universityName: string;
  serviceName: string;
  writeStart: string;
  writeEnd: string;
}): { subject: string; body: string } {
  const { operatorName, universityName, serviceName, writeStart, writeEnd } =
    args;
  const subject = `[진학어플라이] ${universityName} ${serviceName} 인터넷 원서접수 자료 요청 건`;
  const deadline = reminderDeadline(writeStart);
  const lines = [
    "안녕하세요.",
    `진학어플라이 ${operatorName}입니다.`,
    "",
    `${universityName} ${serviceName} 인터넷 원서접수 서비스 작업 관련하여 메일 드립니다.`,
    "",
    deadline
      ? `아래 자료가 준비되시면 ${deadline}까지 회신 부탁드립니다.`
      : "아래 자료가 준비되시면 회신 부탁드립니다.",
    ...(writeStart && writeEnd
      ? [`※ 작년 접수 일정 : ${writeStart} ~ ${writeEnd}`]
      : []),
    "",
    "[요청 자료]",
    "· 모집요강 (PDF 또는 한글파일)",
    "· 추가자료 (전산 레이아웃, 출력물 양식, 참고자료 등)",
    "",
    "페이지 구축은 자료 수신 후 약 2주 정도 소요될 예정입니다.",
    "준비 과정에서 궁금한 사항이 있으시면 연락 부탁드립니다.",
    "",
    "감사합니다.",
  ];
  return { subject, body: lines.join("\n") };
}
