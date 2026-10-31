-- 가족 링크 표와 함수 (docs/11_가족_링크.md). Supabase 대시보드 → SQL Editor에 통째로 붙여 넣고 Run
create table if not exists public.families (
  id text primary key,
  parent_key text not null unique,
  kid_key text not null unique,
  state jsonb not null,
  version integer not null default 1,
  updated_at timestamptz not null default now()
);
alter table public.families enable row level security; -- 정책 없음 = 표를 직접 읽고 쓸 수 없음
revoke all on public.families from anon, authenticated;

create or replace function public.elly_family_insert(p_id text, p_parent_key text, p_kid_key text, p_state jsonb)
returns void language sql security definer set search_path = public as $$
  insert into families (id, parent_key, kid_key, state, version) values (p_id, p_parent_key, p_kid_key, p_state, 1);
$$;

create or replace function public.elly_family_by_key(p_key text)
returns table (id text, role text, kid_key text, state jsonb, version integer)
language sql security definer set search_path = public as $$
  select f.id,
         case when f.parent_key = p_key then 'parent' else 'kid' end,
         case when f.parent_key = p_key then f.kid_key end,
         f.state, f.version
  from families f
  where length(p_key) >= 16 and (f.parent_key = p_key or f.kid_key = p_key)
  limit 1;
$$;

create or replace function public.elly_family_update(p_key text, p_state jsonb, p_expected integer)
returns integer language sql security definer set search_path = public as $$
  update families set state = p_state, version = version + 1, updated_at = now()
  where length(p_key) >= 16 and (parent_key = p_key or kid_key = p_key) and version = p_expected
  returning version;
$$;

create or replace function public.elly_family_rotate(p_parent_key text, p_new_kid_key text)
returns integer language sql security definer set search_path = public as $$
  update families set kid_key = p_new_kid_key, version = version + 1, updated_at = now()
  where length(p_parent_key) >= 16 and parent_key = p_parent_key
  returning version;
$$;

revoke all on function public.elly_family_insert(text, text, text, jsonb) from public;
revoke all on function public.elly_family_by_key(text) from public;
revoke all on function public.elly_family_update(text, jsonb, integer) from public;
revoke all on function public.elly_family_rotate(text, text) from public;
grant execute on function public.elly_family_insert(text, text, text, jsonb) to anon, authenticated;
grant execute on function public.elly_family_by_key(text) to anon, authenticated;
grant execute on function public.elly_family_update(text, jsonb, integer) to anon, authenticated;
grant execute on function public.elly_family_rotate(text, text) to anon, authenticated;
notify pgrst, 'reload schema';
