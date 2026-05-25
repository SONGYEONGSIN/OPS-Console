/**
 * 운영 가이드 탭 데이터.
 * 각 탭은 좌측 nav에서 선택, 우측 panel에 sections로 렌더.
 * 1차는 placeholder + 운영부 공통 안내 — 운영부가 후속에서 항목을 채워간다.
 */

export type GuideSection = {
  heading: string;
  /** 본문 단락(빈 줄 = 단락 분리). 마크다운 미지원, plain text + 줄바꿈 */
  body: string;
  /** 외부/내부 링크 (선택) */
  links?: { label: string; href: string; external?: boolean }[];
};

export type OperatingGuideTab = {
  /** URL ?tab= 값 */
  value: string;
  /** 좌측 nav 라벨 */
  label: string;
  /** 좌측 nav 부가 설명 (한 줄) */
  desc: string;
  sections: GuideSection[];
};

export const OPERATING_GUIDE_TABS: OperatingGuideTab[] = [
  {
    value: "standard-procedure",
    label: "표준 절차 (SOP)",
    desc: "단계별 표준 작업 절차",
    sections: [
      {
        heading: "사고 처리 표준 절차",
        body: "(placeholder) 사고 발생 시 5분 내 표준 대응:\n1. 운영부 공통 채널에 사고 알림 (제목·영향 범위·발생 시각)\n2. assignee 지정 (1차 운영자 + 백업 운영자)\n3. 학교담당자 사전 안내 (정상화 ETA 명시)\n4. OPS-Console 사고 도메인에 case 등록\n5. 정상화 후 30분 내 회고 노트 작성",
      },
      {
        heading: "신규 운영자 첫 주 체크리스트",
        body: "(placeholder) 입사 5일 내 완료해야 할 항목:\n- Microsoft 365 / SharePoint 권한 발급 확인\n- OPS-Console 계정 + 메뉴 권한 부여\n- 사수와 인수인계 매뉴얼 1독\n- 첫 서비스 1건 옆에서 관찰 (shadowing)\n- 운영 가이드의 '바이브코딩' 탭 학습",
      },
      {
        heading: "결제 이슈 대응 절차",
        body: "(placeholder) 결제 게이트웨이 장애 또는 결제 실패 보고 시:\n1. 결제사 상태 페이지 확인 (전체 장애 vs 단발 이슈 구분)\n2. 영향 받는 서비스·학교 식별\n3. 학교담당자에 사전 안내 (대기 요청 + 정상화 ETA)\n4. 사고 도메인에 case 등록 (카테고리: 결제)\n5. 결제사와 직접 컨택 (Slack 또는 메일)\n6. 정상화 후 학교담당자 회신 + 회고",
      },
    ],
  },
  {
    value: "vibe-coding",
    label: "바이브코딩",
    desc: "Claude Code · AI 도구",
    sections: [
      {
        heading: "Claude Code 시작하기",
        body: "터미널에서 'claude' 명령으로 실행합니다.\n프로젝트 루트에서 시작하면 CLAUDE.md / .claude/rules 가 자동 로드되어 작업 맥락이 유지됩니다.\n슬래시 명령(/brainstorm, /plan, /commit 등)으로 정석 작업 흐름을 따라갑니다.",
      },
      {
        heading: "운영부 프롬프트 패턴",
        body: "원하는 결과를 구체적으로: '무엇을 / 누가 / 왜 지금 / 성공' 4문항을 한 문장으로 묶어 전달.\n예시: '계약 시트의 미체결 5건을 운영자별로 묶어 표로 정리해줘. 신규 운영자 인수인계용. 마감 D-7 이내. 표는 markdown.'",
      },
      {
        heading: "주의 사항",
        body: "민감 정보(고객 데이터·인증 토큰)는 프롬프트에 포함하지 않습니다.\nAI 결과는 항상 사람이 검토 후 적용 — '될 거 같다'가 아닌 '실행해서 확인'.",
      },
    ],
  },
  {
    value: "know-how",
    label: "운영 노하우",
    desc: "프로세스 · 팁",
    sections: [
      {
        heading: "원서접수 시즌 점검 루틴",
        body: "(placeholder — 운영부가 채울 영역)\n시즌 시작 D-30 / D-7 / D-Day 체크리스트, 자주 마주치는 결제 이슈, 학교담당자 사전 안내 템플릿 등.",
      },
      {
        heading: "주간 마감 루틴",
        body: "(placeholder) 매주 금요일 16:00까지 마감 정리:\n- 미수채권 청구 발송 확인\n- 사고 처리 진행 상황 공유\n- 다음 주 오픈 서비스 사전 점검",
      },
    ],
  },
  {
    value: "troubleshooting",
    label: "트러블슈팅",
    desc: "자주 질문 · 복구",
    sections: [
      {
        heading: "결제 게이트웨이 오류 — 자주 보이는 패턴",
        body: "(placeholder) 350ms 이상 응답 지연 시 대응 절차:\n1. 결제사 상태 페이지 확인\n2. 영향 받는 서비스 식별\n3. 학교담당자에 사전 안내 — 정상화 전까지 잠시 대기 요청\n4. 사고 도메인에 case 등록",
      },
      {
        heading: "SharePoint 인증 만료",
        body: "(placeholder) 시트가 보이지 않거나 401 에러:\n- 1차: 페이지 새로고침\n- 2차: dev 서버 재시작 (Graph 토큰 캐시 클리어)\n- 3차: Azure AD 권한 확인 (Files.ReadWrite.All)",
      },
    ],
  },
  {
    value: "collaboration",
    label: "협업",
    desc: "메일 · 외부 응대",
    sections: [
      {
        heading: "메일 톤·매너 가이드",
        body: "(placeholder) 외부 학교담당자/결제사 응대:\n- 제목 prefix '[운영부 상황실]'\n- 첫 인사 + 본인 소개 (이름·역할)\n- 한 메일에 하나의 의제\n- 마무리에 회신 기한 명시",
      },
      {
        heading: "내부 공유 규칙",
        body: "(placeholder)\n- 사고 발견 즉시 운영부 공통 채널 알림\n- 의사결정 사항은 사후라도 OPS-Console 공지로 흔적 남기기\n- 외부 발신 메일은 본인 메일박스 + 운영부 상황실 prefix",
      },
    ],
  },
  {
    value: "tools",
    label: "도구 사용법",
    desc: "SharePoint · OPS-Console · Notion",
    sections: [
      {
        heading: "OPS-Console",
        body: "사이드바 카테고리별 메뉴 — 운영부 일일 업무 핵심 도구.\n알림(종) dropdown으로 본인 관련 작업 한눈에 추적.\n검색(상단 ⌘K)으로 메뉴/서비스/계약 등 전역 검색.",
      },
      {
        heading: "SharePoint",
        body: "계약서·문서·매뉴얼 등 마스터 데이터 보관.\nOPS-Console에서 행 클릭 시 SharePoint 웹으로 자동 인계 — 편집·다운로드는 SharePoint UI에서.",
      },
      {
        heading: "Notion",
        body: "(placeholder) 회의록·외부 문서 협업.\n운영부 회의 후 핵심 결정사항만 OPS-Console 공지로 이관 추천.",
      },
    ],
  },
];

export function findTabByValue(value: string): OperatingGuideTab | undefined {
  return OPERATING_GUIDE_TABS.find((t) => t.value === value);
}
