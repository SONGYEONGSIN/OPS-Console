import type { AiTool, AiWorkCategory } from "@/features/ai-work/schemas";

export const AI_TOOL_LABEL: Record<AiTool, string> = {
  claude: "Claude",
  chatgpt: "ChatGPT",
  gemini: "Gemini",
  cursor: "Cursor",
  copilot: "GitHub Copilot",
  notion_ai: "Notion AI",
  etc: "기타",
};

export const AI_TOOL_TONE: Record<AiTool, string> = {
  claude: "bg-vermilion/15 text-vermilion-deep",
  chatgpt: "bg-sage/20 text-sage",
  gemini: "bg-indigo/20 text-indigo",
  cursor: "bg-gold/20 text-gold",
  copilot: "bg-ink/10 text-ink",
  notion_ai: "bg-muted/30 text-muted",
  etc: "bg-line-soft text-ink-muted",
};

export const CATEGORY_LABEL: Record<AiWorkCategory, string> = {
  code: "코드",
  doc: "문서",
  analysis: "분석",
  design: "디자인",
  translation: "번역",
  meeting: "회의",
  automation: "자동화",
  etc: "기타",
};

export const CATEGORY_TONE: Record<AiWorkCategory, string> = {
  code: "bg-indigo/15 text-indigo",
  doc: "bg-ink/10 text-ink",
  analysis: "bg-sage/20 text-sage",
  design: "bg-vermilion/15 text-vermilion-deep",
  translation: "bg-gold/20 text-gold",
  meeting: "bg-muted/30 text-muted",
  automation: "bg-sage/15 text-sage",
  etc: "bg-line-soft text-ink-muted",
};

export const AI_TOOL_OPTIONS: ReadonlyArray<{ value: AiTool; label: string }> = [
  { value: "claude", label: AI_TOOL_LABEL.claude },
  { value: "chatgpt", label: AI_TOOL_LABEL.chatgpt },
  { value: "gemini", label: AI_TOOL_LABEL.gemini },
  { value: "cursor", label: AI_TOOL_LABEL.cursor },
  { value: "copilot", label: AI_TOOL_LABEL.copilot },
  { value: "notion_ai", label: AI_TOOL_LABEL.notion_ai },
  { value: "etc", label: AI_TOOL_LABEL.etc },
];

export const CATEGORY_OPTIONS: ReadonlyArray<{
  value: AiWorkCategory;
  label: string;
}> = [
  { value: "code", label: CATEGORY_LABEL.code },
  { value: "doc", label: CATEGORY_LABEL.doc },
  { value: "analysis", label: CATEGORY_LABEL.analysis },
  { value: "design", label: CATEGORY_LABEL.design },
  { value: "translation", label: CATEGORY_LABEL.translation },
  { value: "meeting", label: CATEGORY_LABEL.meeting },
  { value: "automation", label: CATEGORY_LABEL.automation },
  { value: "etc", label: CATEGORY_LABEL.etc },
];
