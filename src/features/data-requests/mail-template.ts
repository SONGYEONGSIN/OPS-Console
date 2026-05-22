/** 진학어플라이 자료요청 평문 기본값 생성 (제목 + 본문). 운영자가 검토·편집 후 발송. */
export function buildDefaultDataRequestText(args: {
  operatorName: string;
  universityName: string;
  serviceName: string;
  writeStart: string;
  writeEnd: string;
}): { subject: string; body: string } {
  const { operatorName, universityName, serviceName, writeStart, writeEnd } = args;
  const subject = `[진학어플라이] ${universityName} ${serviceName} 인터넷 원서접수 자료 요청 건`;
  const lines = [
    "안녕하세요.",
    `진학어플라이 ${operatorName}입니다.`,
    "",
    `${universityName} ${serviceName} 인터넷 원서접수 서비스 진행 관련하여 메일드립니다.`,
    ...(writeStart && writeEnd ? [`(작년 일정 : ${writeStart} ~ ${writeEnd})`] : []),
    "",
    "[요청 항목]",
    "- 모집요강",
    "- 전산자료(레이아웃, 코드자료 등)",
    "- 원서작업에 필요한 추가 자료",
    "",
    "원활한 서비스 준비를 위해 최소 2주 전까지 자료 회신 요청드립니다.",
    "감사합니다.",
  ];
  return { subject, body: lines.join("\n") };
}
