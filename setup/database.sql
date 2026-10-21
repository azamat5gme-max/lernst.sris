-- Learnst shared registration backend. Run in your Supabase SQL Editor.
-- This creates app tables/functions, not admin users or sample registrations.
begin;

create table if not exists public.learnst_settings (
  singleton boolean primary key default true check (singleton),
  school_name text not null default 'Your school',
  school_domains text[] not null default '{}'
);
insert into public.learnst_settings(singleton) values (true) on conflict do nothing;

create table if not exists public.learnst_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null check (char_length(btrim(full_name)) between 1 and 60),
  year text not null check (char_length(btrim(year)) between 1 and 24),
  created_at timestamptz not null default now()
);
create table if not exists public.learnst_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
create table if not exists public.learnst_lessons (
  id uuid primary key default gen_random_uuid(),
  subject text not null check (subject in ('science','english','math')),
  title text not null check (char_length(btrim(title)) between 1 and 100),
  teacher_name text not null check (char_length(btrim(teacher_name)) between 1 and 60),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  capacity integer not null check (capacity between 1 and 50),
  mode text not null check (mode in ('campus','online')),
  location text not null check (char_length(btrim(location)) between 1 and 180),
  description text not null default '' check (char_length(description) <= 600),
  status text not null default 'published' check (status in ('published','cancelled')),
  created_at timestamptz not null default now(),
  check (ends_at = starts_at + interval '1 hour')
);
create table if not exists public.learnst_enrolments (
  id uuid primary key default gen_random_uuid(),
  lesson_id uuid not null references public.learnst_lessons(id),
  student_id uuid not null references public.learnst_profiles(id) on delete cascade,
  status text not null default 'active' check (status in ('active','cancelled')),
  note text not null default '' check (char_length(note) <= 600),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (lesson_id,student_id)
);
create index if not exists learnst_lessons_start on public.learnst_lessons(starts_at);
create index if not exists learnst_enrolments_lesson on public.learnst_enrolments(lesson_id,status);
create index if not exists learnst_enrolments_student on public.learnst_enrolments(student_id,status);

-- Signup metadata only supplies a name/class. It can never grant admin access.
create or replace function public.learnst_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
declare allowed text[];
begin
  select s.school_domains into allowed from public.learnst_settings s where s.singleton;
  if new.email is null then raise exception 'Use an email address to register.'; end if;
  if coalesce(cardinality(allowed),0) > 0 and not (lower(split_part(new.email,'@',2)) = any(allowed)) then
    raise exception 'Registration is limited to school email addresses.';
  end if;
  insert into public.learnst_profiles(id,full_name,year)
  values (new.id,
    left(coalesce(nullif(btrim(new.raw_user_meta_data->>'full_name'),''),split_part(new.email,'@',1)),60),
    left(coalesce(nullif(btrim(new.raw_user_meta_data->>'year'),''),'Not set'),24))
  on conflict (id) do nothing;
  return new;
end;
$$;
drop trigger if exists learnst_on_signup on auth.users;
create trigger learnst_on_signup after insert on auth.users
for each row execute function public.learnst_new_user();

-- Include accounts created before this schema was installed.
insert into public.learnst_profiles(id,full_name,year)
select u.id,
  left(coalesce(nullif(btrim(u.raw_user_meta_data->>'full_name'),''),split_part(u.email,'@',1)),60),
  left(coalesce(nullif(btrim(u.raw_user_meta_data->>'year'),''),'Not set'),24)
from auth.users u where u.email is not null
on conflict (id) do nothing;

create or replace function public.learnst_is_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.learnst_admins a where a.user_id = auth.uid());
$$;
create or replace function public.learnst_require_user()
returns uuid language plpgsql stable security definer set search_path = '' as $$
declare who uuid := auth.uid();
begin
  if who is null then raise exception 'Sign in to continue.' using errcode = '28000'; end if;
  if not exists(select 1 from auth.users u where u.id = who and u.email_confirmed_at is not null) then
    raise exception 'Confirm your email before continuing.' using errcode = '28000';
  end if;
  return who;
end;
$$;
create or replace function public.learnst_require_admin()
returns void language plpgsql stable security definer set search_path = '' as $$
begin
  perform public.learnst_require_user();
  if not public.learnst_is_admin() then
    raise exception 'This account does not have admin access.' using errcode = '42501';
  end if;
end;
$$;

alter table public.learnst_settings enable row level security;
alter table public.learnst_profiles enable row level security;
alter table public.learnst_admins enable row level security;
alter table public.learnst_lessons enable row level security;
alter table public.learnst_enrolments enable row level security;
drop policy if exists learnst_profile_read on public.learnst_profiles;
create policy learnst_profile_read on public.learnst_profiles for select to authenticated
using (id = (select auth.uid()) or (select public.learnst_is_admin()));
drop policy if exists learnst_admin_read on public.learnst_admins;
create policy learnst_admin_read on public.learnst_admins for select to authenticated
using (user_id = (select auth.uid()));
drop policy if exists learnst_lesson_read on public.learnst_lessons;
create policy learnst_lesson_read on public.learnst_lessons for select to anon,authenticated
using (status = 'published' or (select public.learnst_is_admin()));
drop policy if exists learnst_enrolment_read on public.learnst_enrolments;
create policy learnst_enrolment_read on public.learnst_enrolments for select to authenticated
using (student_id = (select auth.uid()) or (select public.learnst_is_admin()));

-- All writes go through checked functions. Browsers cannot directly write tables.
revoke all on public.learnst_settings,public.learnst_profiles,public.learnst_admins,
  public.learnst_lessons,public.learnst_enrolments from anon,authenticated;
grant select on public.learnst_profiles,public.learnst_admins,public.learnst_enrolments to authenticated;
grant select on public.learnst_lessons to anon,authenticated;

create or replace function public.learnst_school()
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('school_name',s.school_name,'school_domains',s.school_domains)
  from public.learnst_settings s where s.singleton;
$$;
create or replace function public.learnst_profile()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare who uuid := public.learnst_require_user(); result jsonb;
begin
  select jsonb_build_object('id',p.id,'full_name',p.full_name,'year',p.year,'email',u.email,
    'created_at',p.created_at,'is_admin',public.learnst_is_admin()) into result
  from public.learnst_profiles p join auth.users u on u.id=p.id where p.id=who;
  return result;
end;
$$;
create or replace function public.learnst_update_profile(p_full_name text,p_year text)
returns void language plpgsql security definer set search_path = '' as $$
declare who uuid := public.learnst_require_user();
begin
  if p_full_name is null or char_length(btrim(p_full_name)) not between 1 and 60 or
    p_year is null or char_length(btrim(p_year)) not between 1 and 24 then raise exception 'Enter your name and class.'; end if;
  update public.learnst_profiles set full_name=btrim(p_full_name),year=btrim(p_year) where id=who;
end;
$$;
create or replace function public.learnst_catalog()
returns jsonb language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(to_jsonb(q) order by q.starts_at,q.id),'[]'::jsonb)
  from (select l.*, (select count(*) from public.learnst_enrolments e where e.lesson_id=l.id and e.status='active') as registered_count
    from public.learnst_lessons l where l.status='published' and l.ends_at>now()) q;
$$;
create or replace function public.learnst_my_enrolments()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare who uuid := public.learnst_require_user(); result jsonb;
begin
  select coalesce(jsonb_agg(jsonb_build_object('id',e.id,'lesson_id',e.lesson_id,'status',e.status,
    'note',e.note,'created_at',e.created_at,'lesson',to_jsonb(l)) order by l.starts_at),'[]'::jsonb)
  into result from public.learnst_enrolments e join public.learnst_lessons l on l.id=e.lesson_id where e.student_id=who;
  return result;
end;
$$;

create or replace function public.learnst_register(p_lesson_id uuid,p_note text default '')
returns uuid language plpgsql security definer set search_path = '' as $$
declare who uuid := public.learnst_require_user(); item public.learnst_lessons%rowtype;
  existing public.learnst_enrolments%rowtype; allowed text[]; mail text; answer uuid;
begin
  if p_note is null or char_length(p_note)>600 then raise exception 'Keep your question within 600 characters.'; end if;
  select s.school_domains into allowed from public.learnst_settings s where s.singleton;
  select u.email into mail from auth.users u where u.id=who;
  if coalesce(cardinality(allowed),0)>0 and not public.learnst_is_admin() and not (lower(split_part(mail,'@',2))=any(allowed)) then
    raise exception 'Use a school email account to register for lessons.';
  end if;
  if not exists(select 1 from public.learnst_profiles p where p.id=who and p.year<>'Not set') then
    raise exception 'Add your name and class on the Account page first.';
  end if;
  -- Serialize this student's requests, then lock the lesson to enforce capacity.
  perform pg_advisory_xact_lock(hashtextextended(who::text,0));
  select * into item from public.learnst_lessons where id=p_lesson_id for update;
  if not found or item.status<>'published' or item.starts_at<=now() then raise exception 'This lesson is no longer open for registration.'; end if;
  select * into existing from public.learnst_enrolments where lesson_id=item.id and student_id=who;
  if found and existing.status='active' then return existing.id; end if;
  if (select count(*) from public.learnst_enrolments e where e.lesson_id=item.id and e.status='active')>=item.capacity then
    raise exception 'This lesson is full. Choose another time.';
  end if;
  if exists(select 1 from public.learnst_enrolments e join public.learnst_lessons l on l.id=e.lesson_id
    where e.student_id=who and e.status='active' and l.status='published' and l.id<>item.id
      and l.starts_at<item.ends_at and item.starts_at<l.ends_at) then
    raise exception 'You already have a lesson at this time. Choose another hour.';
  end if;
  insert into public.learnst_enrolments(lesson_id,student_id,note)
  values(item.id,who,btrim(p_note))
  on conflict (lesson_id,student_id) do update set status='active',note=excluded.note,updated_at=now()
  returning id into answer;
  return answer;
end;
$$;
create or replace function public.learnst_cancel_registration(p_enrolment_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare who uuid := public.learnst_require_user(); item_id uuid; lesson_start timestamptz;
begin
  perform pg_advisory_xact_lock(hashtextextended(who::text,0));
  select e.lesson_id into item_id from public.learnst_enrolments e where e.id=p_enrolment_id and e.student_id=who;
  if not found then raise exception 'This registration could not be found.'; end if;
  select l.starts_at into lesson_start from public.learnst_lessons l where l.id=item_id for update;
  if lesson_start<=now() then raise exception 'Past registrations stay in your history.'; end if;
  update public.learnst_enrolments set status='cancelled',updated_at=now() where id=p_enrolment_id and student_id=who;
end;
$$;

create or replace function public.learnst_admin_dashboard()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare result jsonb;
begin
  perform public.learnst_require_admin();
  select jsonb_build_object(
    'profiles',(select coalesce(jsonb_agg(jsonb_build_object('id',p.id,'full_name',p.full_name,'year',p.year,
      'email',u.email,'confirmed',u.email_confirmed_at is not null,'created_at',p.created_at,
      'is_admin',exists(select 1 from public.learnst_admins a where a.user_id=p.id)) order by p.created_at desc),'[]'::jsonb)
      from public.learnst_profiles p join auth.users u on u.id=p.id),
    'lessons',(select coalesce(jsonb_agg(to_jsonb(q) order by q.starts_at desc),'[]'::jsonb) from
      (select l.*, (select count(*) from public.learnst_enrolments e where e.lesson_id=l.id and e.status='active') as registered_count from public.learnst_lessons l) q),
    'registrations',(select coalesce(jsonb_agg(to_jsonb(e) order by e.created_at desc),'[]'::jsonb) from public.learnst_enrolments e),
    'updated_at',now()) into result;
  return result;
end;
$$;
create or replace function public.learnst_admin_create_lesson(p_subject text,p_title text,p_teacher_name text,
  p_starts_at timestamptz,p_capacity integer,p_mode text,p_location text,p_description text default '')
returns uuid language plpgsql security definer set search_path = '' as $$
declare answer uuid;
begin
  perform public.learnst_require_admin();
  if p_starts_at is null or p_starts_at<=now() then raise exception 'Choose a future lesson time.'; end if;
  if p_subject is null or p_subject not in ('science','english','math') then raise exception 'Choose Science, English or Maths.'; end if;
  if p_title is null or char_length(btrim(p_title)) not between 1 and 100 or
    p_teacher_name is null or char_length(btrim(p_teacher_name)) not between 1 and 60 or
    p_location is null or char_length(btrim(p_location)) not between 1 and 180 or
    p_description is null or char_length(p_description)>600 then raise exception 'Check the lesson title, tutor and location.'; end if;
  if p_capacity is null or p_capacity not between 1 and 50 then raise exception 'Capacity must be between 1 and 50.'; end if;
  if p_mode is null or p_mode not in ('campus','online') then raise exception 'Choose a lesson format.'; end if;
  if to_char(p_starts_at at time zone 'Asia/Bishkek','MI:SS')<>'00:00' then raise exception 'Choose a start time on the hour.'; end if;
  perform pg_advisory_xact_lock(hashtextextended('teacher:'||lower(btrim(p_teacher_name)),0));
  if exists(select 1 from public.learnst_lessons l where l.status='published'
    and lower(l.teacher_name)=lower(btrim(p_teacher_name)) and l.starts_at<p_starts_at+interval '1 hour' and p_starts_at<l.ends_at) then
    raise exception 'This tutor already has a lesson at that time.';
  end if;
  insert into public.learnst_lessons(subject,title,teacher_name,starts_at,ends_at,capacity,mode,location,description)
  values(p_subject,btrim(p_title),btrim(p_teacher_name),p_starts_at,p_starts_at+interval '1 hour',p_capacity,p_mode,btrim(p_location),btrim(p_description))
  returning id into answer;
  return answer;
end;
$$;
create or replace function public.learnst_admin_cancel_lesson(p_lesson_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  perform public.learnst_require_admin();
  perform 1 from public.learnst_lessons l where l.id=p_lesson_id for update;
  if not found then raise exception 'This lesson could not be found.'; end if;
  update public.learnst_lessons set status='cancelled' where id=p_lesson_id;
  update public.learnst_enrolments set status='cancelled',updated_at=now() where lesson_id=p_lesson_id and status='active';
end;
$$;

-- SECURITY DEFINER functions are closed by default; expose only checked APIs.
do $$ declare item record; begin
  for item in select p.oid::regprocedure as signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and left(p.proname,8)='learnst_'
  loop execute format('revoke execute on function %s from public,anon,authenticated',item.signature); end loop;
end; $$;
grant execute on function public.learnst_is_admin() to anon,authenticated;
grant execute on function public.learnst_school(),public.learnst_catalog() to anon,authenticated;
grant execute on function public.learnst_profile(),public.learnst_update_profile(text,text),
  public.learnst_my_enrolments(),public.learnst_register(uuid,text),public.learnst_cancel_registration(uuid),
  public.learnst_admin_dashboard(),public.learnst_admin_create_lesson(text,text,text,timestamptz,integer,text,text,text),
  public.learnst_admin_cancel_lesson(uuid) to authenticated;

commit;
