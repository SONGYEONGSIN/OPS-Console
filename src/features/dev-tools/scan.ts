/**
 * 레포 `.claude/` 안의 도구를 읽는다 — 스킬·에이전트·훅·룰.
 *
 * MCP·플러그인은 여기 없다. 둘 다 `~/.claude.json` 과 `~/.claude/settings.json`
 * 에 있어 git 에 안 들어오고, Vercel 에서는 홈 디렉터리를 볼 수 없다.
 *
 * 파일을 읽는 일은 `scripts/scan-claude-tools.mjs` 가 하고 여기는 **파싱만** 한다.
 * 그래야 "설명이 없는 훅", "폴더명과 frontmatter name 이 다른 스킬" 같은 경우를
 * 실제 파일 없이 테스트할 수 있다.
 */

export type ToolKind = "skill" | "agent" | "hook" | "rule";

export type ToolEntry = {
  kind: ToolKind;
  /** 화면·토글이 쓰는 식별자. 스킬은 폴더명(호출에 쓰이는 이름)이다. */
  name: string;
  description: string;
  /** 레포 기준 상대 경로. 어디를 고치면 되는지 바로 알 수 있어야 한다. */
  path: string;
  /** 불러 쓰는 방법. 훅·룰은 사람이 부르는 게 아니라 없다. */
  invoke: string | null;
  /** 종류마다 다른 부가 정보(effort·model·event·paths…). */
  meta: Record<string, string>;
  /** 화면에서 끌 수 있는가. */
  toggleable: boolean;
};

/**
 * frontmatter 파싱.
 *
 * YAML 파서를 붙이지 않는다 — 여기 오는 건 우리가 쓴 파일이고 형태가 단순하다
 * (`키: 값` 과 `- 항목` 목록뿐). 의존성을 하나 늘릴 값이 아니다.
 */
export function parseFrontmatter(text: string): {
  data: Record<string, string>;
  body: string;
} {
  if (!text.startsWith("---\n")) return { data: {}, body: text };
  const end = text.indexOf("\n---", 3);
  if (end < 0) return { data: {}, body: text };

  const head = text.slice(4, end);
  const body = text.slice(end + 4).replace(/^\n/, "");

  const data: Record<string, string> = {};
  let lastKey: string | null = null;
  const listed: Record<string, string[]> = {};
  // `description: |` 처럼 값이 다음 줄부터 들여쓰기로 이어지는 경우.
  const blocks: Record<string, string[]> = {};
  let blockKey: string | null = null;

  for (const line of head.split("\n")) {
    if (blockKey) {
      if (/^\s+\S/.test(line)) {
        blocks[blockKey].push(line.trim());
        continue;
      }
      // 들여쓰기가 끝나면 블록도 끝이다.
      blockKey = null;
    }
    // `- "src/**"` — 바로 앞 키의 목록 항목.
    const item = /^\s+-\s*(.*)$/.exec(line);
    if (item && lastKey) {
      (listed[lastKey] ??= []).push(unquote(item[1].trim()));
      continue;
    }
    // 첫 콜론에서만 자른다 — 설명에 "사용법: /foo" 처럼 콜론이 흔하다.
    const i = line.indexOf(":");
    if (i < 0) continue;
    const key = line.slice(0, i).trim();
    if (!key || /^\s/.test(line)) continue;
    const value = line.slice(i + 1).trim();
    lastKey = key;
    if (value === "|" || value === ">") {
      blockKey = key;
      blocks[key] = [];
      continue;
    }
    if (value) data[key] = unquote(value);
  }

  for (const [k, v] of Object.entries(blocks)) data[k] = v.join("\n");
  for (const [k, v] of Object.entries(listed)) data[k] = v.join(", ");
  return { data, body };
}

/** 본문 첫 문단. 제목(#)과 빈 줄은 건너뛴다. */
function firstParagraph(body: string): string {
  for (const block of body.split(/\n\s*\n/)) {
    const t = block.trim();
    if (!t || t.startsWith("#")) continue;
    return t.replace(/\n/g, " ");
  }
  return "";
}

/**
 * 양끝을 **함께** 감싼 따옴표만 벗긴다.
 *
 * 한쪽만 지우면 `사용법 /auto-build "<task>"` 의 끝 인용부호가 잘려 설명이
 * 말끝을 잃는다(실제로 auto-build 스킬이 그렇게 잘렸다).
 */
function unquote(v: string): string {
  const q = v[0];
  if ((q === '"' || q === "'") && v.length > 1 && v.endsWith(q)) {
    return v.slice(1, -1);
  }
  return v;
}

/**
 * `<example>Context: …</example>` 는 에이전트를 **고를 때** 쓰는 트리거 문서다.
 * 사람이 읽는 설명이 아니라 목록에 그대로 두면 화면이 태그로 찬다.
 */
function withoutExamples(v: string): string {
  const i = v.indexOf("<example>");
  return (i < 0 ? v : v.slice(0, i)).trim();
}

function pick(
  data: Record<string, string>,
  keys: string[],
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const k of keys) if (data[k]) out[k] = data[k];
  return out;
}

/**
 * 스킬. **이름은 폴더명을 쓴다** — 호출이 폴더명으로 되므로 frontmatter 의
 * name 이 다르면 그쪽이 틀린 것이다.
 */
export function skillEntry(folder: string, md: string): ToolEntry {
  const { data } = parseFrontmatter(md);
  return {
    kind: "skill",
    name: folder,
    description: data.description ?? "",
    path: `.claude/skills/${folder}/SKILL.md`,
    invoke: `Skill("${folder}")`,
    meta: pick(data, ["effort", "model", "allowed-tools"]),
    // permissions.deny 로 막을 수 있는 유일한 종류다.
    toggleable: true,
  };
}

export function agentEntry(file: string, md: string): ToolEntry {
  const { data } = parseFrontmatter(md);
  const name = file.replace(/\.md$/, "");
  return {
    kind: "agent",
    name,
    description: withoutExamples(data.description ?? ""),
    path: `.claude/agents/${file}`,
    invoke: `Agent(subagent_type: "${name}")`,
    meta: pick(data, ["model", "tools", "effort", "maxTurns", "memory"]),
    // 파일이 있으면 곧 활성이다. 끄려면 파일을 옮겨야 하고 그건 git 변경이라
    // 화면에서 할 일이 아니다.
    toggleable: false,
  };
}

/** `# 이름.sh — 시점 — 설명` 형태의 머리말에서 읽는다. */
const HOOK_HEAD = /^#\s*[\w.-]+\.sh\s*[—–-]\s*(.*)$/;

const HOOK_EVENTS = [
  "UserPromptSubmit",
  "PreToolUse",
  "PostToolUseFailure",
  "PostToolUse",
  "Notification",
  "PreCompact",
  "SessionStart",
  "Stop",
];

export function hookEntry(file: string, sh: string): ToolEntry {
  const name = file.replace(/\.sh$/, "");
  let head = "";
  for (const raw of sh.split("\n").slice(0, 8)) {
    const line = raw.trim();
    // 셔뱅과 `set -u  # 주석` 같은 설정 줄은 설명이 아니다.
    if (!line.startsWith("#") || line.startsWith("#!")) continue;
    const text = line.replace(/^#+\s*/, "").trim();
    if (!text) continue;
    // `tdd-enforce.sh — …` 처럼 파일명으로 시작하면 그 앞부분은 군더더기다.
    const named = HOOK_HEAD.exec(line);
    head = named ? named[1].trim() : text;
    break;
  }
  // 머리말이 없으면 비워 둔다. 첫 줄을 아무거나 가져오면 `#!/bin/bash` 가 설명이 된다.
  const meta: Record<string, string> = {};
  const event = HOOK_EVENTS.find((e) => head.includes(e));
  if (event) meta.event = event;

  return {
    kind: "hook",
    name,
    description: head,
    path: `.claude/hooks/${file}`,
    invoke: null,
    meta,
    // 훅은 settings.local.json 의 hooks 배열이 정하는데, 그 구조는 도구마다
    // 명령줄이 달라 이름만으로 넣고 뺄 수 없다.
    toggleable: false,
  };
}

export function ruleEntry(file: string, md: string): ToolEntry {
  const { data, body } = parseFrontmatter(md);
  return {
    kind: "rule",
    name: file.replace(/\.md$/, ""),
    description: firstParagraph(body),
    path: `.claude/rules/${file}`,
    invoke: null,
    // paths 가 없으면 전역이다 — 화면에서 그렇게 읽는다.
    meta: pick(data, ["paths"]),
    toggleable: false,
  };
}
