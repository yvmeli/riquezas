-- Owner-managed invitations. Recipient identity comes from Auth, never browser metadata.
create table public.user_access (
 user_id uuid primary key references auth.users(id) on delete cascade,
 disabled_at timestamptz
);
alter table public.user_access enable row level security;
revoke all on public.user_access from anon,authenticated;
grant select on public.user_access to authenticated;

create function public.user_is_active() returns boolean language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and not exists(select 1 from public.user_access where user_id=auth.uid() and disabled_at is not null);
$$;
revoke execute on function public.user_is_active() from public,anon;
grant execute on function public.user_is_active() to authenticated;
create policy own_access_status on public.user_access for select to authenticated using(user_id=auth.uid());
create or replace function public.admin_has(roles text[]) returns boolean language sql stable security definer set search_path='' as $$
 select public.user_is_active() and exists(select 1 from public.admin_roles where user_id=auth.uid() and role=any(roles));
$$;
create or replace function public.trial_active() returns boolean language sql stable security definer set search_path='' as $$
 select public.user_is_active() and exists(select 1 from public.trials where user_id=auth.uid() and expires_at>now() and not suspended);
$$;

-- Restrictive gate composes with existing ownership/RBAC policies; it never broadens them.
do $$ declare t text; begin
 foreach t in array array['profiles','admin_roles','trials','audit_events','appointments','accounts','transactions','budgets','goals','contributions','categories','bank_connections','imports','import_rows','sync_runs','system_settings'] loop
  execute format('create policy active_account on public.%I as restrictive for all to authenticated using(public.user_is_active()) with check(public.user_is_active())',t);
 end loop;
end $$;

create table public.user_invitations (
 id uuid primary key default gen_random_uuid(),
 email text not null check(email=lower(email) and length(email) between 3 and 254),
 role text not null check(role in ('client','support','operator','owner')),
 invited_by uuid not null references auth.users(id),
 created_at timestamptz not null default now(),
 expires_at timestamptz not null default now()+interval '7 days',
 accepted_at timestamptz, accepted_by uuid references auth.users(id), revoked_at timestamptz,
 delivery_status text not null default 'pending' check(delivery_status in ('pending','sent','failed')),
 last_sent_at timestamptz,
 check(expires_at>created_at), check((accepted_at is null)=(accepted_by is null))
);
alter table public.user_invitations enable row level security;
revoke all on public.user_invitations from anon,authenticated;
grant select on public.user_invitations to authenticated;
create policy owner_invitations on public.user_invitations for select to authenticated using(public.admin_has(array['owner']) and public.user_is_active());

create function public.manage_invitation(p_email text default null,p_role text default null,p_id uuid default null,p_action text default 'create')
returns public.user_invitations language plpgsql security definer set search_path='' as $$
declare r public.user_invitations; begin
 if not public.user_is_active() or not public.admin_has(array['owner']) then raise exception 'denied' using errcode='42501'; end if;
 if p_action='create' then
  if p_role not in ('client','support','operator','owner') or p_email is null or p_email not like '%@%' then raise exception 'invalid invitation'; end if;
  perform pg_advisory_xact_lock(hashtext(lower(p_email)));
  if exists(select 1 from public.user_invitations where email=lower(p_email) and accepted_at is null and revoked_at is null and expires_at>now()) then raise exception 'pending invitation exists' using errcode='23505'; end if;
  insert into public.user_invitations(email,role,invited_by,last_sent_at) values(lower(p_email),p_role,auth.uid(),now()) returning * into r;
 else
  select * into strict r from public.user_invitations where id=p_id for update;
  if r.accepted_at is not null or r.revoked_at is not null then raise exception 'invitation closed'; end if;
  if p_action='revoke' then
   update public.user_invitations set revoked_at=now() where id=p_id returning * into r;
  elsif p_action='resend' then
   if r.last_sent_at>now()-interval '60 seconds' then raise exception 'retry later' using errcode='P0001'; end if;
   update public.user_invitations set expires_at=now()+interval '7 days',delivery_status='pending',last_sent_at=now() where id=p_id returning * into r;
  elsif p_action in ('sent','failed') then
   update public.user_invitations set delivery_status=p_action,last_sent_at=now() where id=p_id returning * into r;
  else raise exception 'invalid invitation action'; end if;
 end if;
 insert into public.audit_events(actor_id,action,details) values(auth.uid(),'invitation.'||p_action,jsonb_build_object('invitation_id',r.id,'role',r.role));
 return r;
end $$;

create function public.my_invitation(p_id uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare r public.user_invitations; begin
 if not public.user_is_active() then raise exception 'denied' using errcode='42501'; end if;
 select i.* into strict r from public.user_invitations i join auth.users u on u.id=auth.uid() and lower(u.email)=i.email and u.email_confirmed_at is not null where i.id=p_id;
 return jsonb_build_object('id',r.id,'role',r.role,'expires_at',r.expires_at,'accepted_at',r.accepted_at,'revoked_at',r.revoked_at);
end $$;

create function public.accept_invitation(p_id uuid,p_terms boolean) returns text language plpgsql security definer set search_path='' as $$
declare r public.user_invitations; begin
 if p_terms is distinct from true or not public.user_is_active() then raise exception 'denied' using errcode='42501'; end if;
 select i.* into strict r from public.user_invitations i join auth.users u on u.id=auth.uid() and lower(u.email)=i.email and u.email_confirmed_at is not null where i.id=p_id for update of i;
 if r.accepted_at is not null or r.revoked_at is not null or r.expires_at<=now() then raise exception 'invitation closed' using errcode='42501'; end if;
 -- Client invitations never silently remove an existing administrative role.
 if r.role<>'client' then
  insert into public.admin_roles(user_id,role) values(auth.uid(),r.role) on conflict(user_id) do update set role=excluded.role;
 end if;
 insert into public.profiles(id) values(auth.uid()) on conflict do nothing;
 insert into public.trials(user_id,started_at,expires_at) select auth.uid(),now(),now()+make_interval(days=>trial_days) from public.system_settings on conflict do nothing;
 update public.user_invitations set accepted_at=now(),accepted_by=auth.uid() where id=p_id;
 insert into public.audit_events(actor_id,subject_id,action,details) values(auth.uid(),auth.uid(),'invitation.accepted',jsonb_build_object('invitation_id',p_id,'role',r.role,'terms_version','mvp-2026-10'));
 return case when exists(select 1 from public.admin_roles where user_id=auth.uid()) then 'admin' else 'client' end;
end $$;

create function public.list_managed_users() returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if not public.user_is_active() or not public.admin_has(array['owner']) then raise exception 'denied' using errcode='42501'; end if;
 return coalesce((select jsonb_agg(jsonb_build_object('id',p.id,'email',u.email,'role',coalesce(r.role,'client'),'disabled_at',a.disabled_at)) from public.profiles p join auth.users u on u.id=p.id left join public.admin_roles r on r.user_id=p.id left join public.user_access a on a.user_id=p.id),'[]'::jsonb);
end $$;

create function public.set_user_access(p_user_id uuid,p_disabled boolean) returns void language plpgsql security definer set search_path='' as $$
begin
 if not public.user_is_active() or not public.admin_has(array['owner']) or p_user_id=auth.uid() then raise exception 'denied' using errcode='42501'; end if;
 if not exists(select 1 from public.profiles where id=p_user_id) then raise exception 'unknown user'; end if;
 insert into public.user_access(user_id,disabled_at) values(p_user_id,case when p_disabled then now() end) on conflict(user_id) do update set disabled_at=excluded.disabled_at;
 insert into public.audit_events(actor_id,subject_id,action,details) values(auth.uid(),p_user_id,'user.access_changed',jsonb_build_object('disabled',p_disabled));
end $$;

revoke execute on function public.manage_invitation(text,text,uuid,text),public.my_invitation(uuid),public.accept_invitation(uuid,boolean),public.list_managed_users(),public.set_user_access(uuid,boolean) from public,anon;
grant execute on function public.manage_invitation(text,text,uuid,text),public.my_invitation(uuid),public.accept_invitation(uuid,boolean),public.list_managed_users(),public.set_user_access(uuid,boolean) to authenticated;
