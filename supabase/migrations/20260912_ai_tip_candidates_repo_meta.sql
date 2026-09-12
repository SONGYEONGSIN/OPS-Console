-- 후보 리포의 언어·마지막 푸시 + 그 값을 언제 읽었는지.
--
-- `repo_synced_at` 이 세 값(별 포함)의 시점을 한꺼번에 책임진다. 이게 없으면
-- `repo_language` 가 비어 있는 이유를 **구분할 수 없다** — 우리가 안 물어본 것과
-- 물어봤는데 주 언어가 없는 리포(문서·설정 전용)는 고칠 곳이 다르다.
--
--   language NULL + synced NULL      → 안 물어봤다     → 화면에 '—'
--   language NULL + synced NOT NULL  → 주 언어가 없다  → 화면에 '없음'
--
-- `repo_pushed_at` 은 대칭이 아니다. 모든 리포는 최소 한 번 푸시됐으므로
-- '진짜 없음'이 존재하지 않는다 — NULL 이면 언제나 '못 받았다'이다.
--
-- `updated_at` 이 아니라 `pushed_at` 을 쓴다. `updated_at` 은 설명 수정·설정
-- 변경 같은 메타데이터 이벤트에도 움직여서, 코드가 2년째 멈춘 리포도 최근
-- 갱신된 것처럼 보인다. "이 도구가 살아 있나"에는 마지막 푸시만 답이 된다.

begin;

alter table public.ai_tip_candidates
  add column if not exists repo_language  text,
  add column if not exists repo_pushed_at timestamptz,
  add column if not exists repo_synced_at timestamptz;

-- **기본값을 add column 과 같은 문장에 두지 않는다.**
-- Postgres 는 `ADD COLUMN ... DEFAULT` 를 기존 행에도 채운다. 그러면 기존 20건이
-- '지금 GitHub 에 물어봤다'고 주장하게 되고 위 구분이 영구히 불가능해진다.
-- 나눠 쓰면 기존 행은 null(안 물어봤다), 이후 insert 만 now() 다.
alter table public.ai_tip_candidates
  alter column repo_synced_at set default now();

commit;

-- 빠뜨리면 PostgREST 가 옛 컬럼 목록을 들고 있어 `select("*")` 에 새 칸이 안 실린다.
notify pgrst, 'reload schema';
