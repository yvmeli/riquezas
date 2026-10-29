-- No financial sample data. Apply using Supabase CLI to a local instance first.
-- gen_random_uuid() is built into PostgreSQL 13+; no privileged extension needed.

create table public.system_settings (
 id boolean primary key default true check (id), trial_days integer not null default 14 check(trial_days between 1 and 90)
);
insert into public.system_settings default values;

create table public.profiles (
 id uuid primary key references auth.users(id) on delete cascade,
 first_name text not null default '', last_name text not null default '', phone text not null default '',
 terms_accepted_at timestamptz not null default now(), terms_version text not null default 'mvp-2026-10',
 template text not null default 'basic' check(template in ('basic','budget','saving')),
 methods text[] not null default '{manual}' check(methods <@ array['manual','gmail','pdf']::text[] and cardinality(methods) between 1 and 3), onboarding_completed boolean not null default false,
 created_at timestamptz not null default now()
);
create table public.admin_roles (
 user_id uuid primary key references auth.users(id) on delete cascade,
 role text not null check(role in ('support','operator','owner'))
);
create table public.trials (
 user_id uuid primary key references auth.users(id) on delete cascade,
 started_at timestamptz not null, expires_at timestamptz not null,
 suspended boolean not null default false, check(expires_at >= started_at)
);
create table public.audit_events (
 id bigint generated always as identity primary key,
 actor_id uuid, subject_id uuid, action text not null,
 details jsonb not null default '{}', created_at timestamptz not null default now()
);
create table public.appointments (
 id uuid primary key default gen_random_uuid(), name text not null check(length(name) between 2 and 120),
 email text not null check(length(email)<=254), phone text not null check(length(phone) between 7 and 30),
 modality text not null check(modality in ('whatsapp','video','in_person')),
 preferred_at timestamptz not null, scheduled_at timestamptz,
 status text not null default 'requested' check(status in ('requested','confirmed','rescheduled','cancelled','closed')),
 outcome text not null default '' check(length(outcome)<=500),
 consent_at timestamptz not null default now(), created_at timestamptz not null default now()
);
create table public.accounts (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
 name text not null check(length(name) between 1 and 80),
 institution text not null check(institution in ('qik','popular','other')),
 kind text not null check(kind in ('debit','savings','credit')),
 currency text not null check(currency in ('DOP','USD')), opening_balance numeric(16,2) not null default 0,
 last_four text check(last_four ~ '^\d{4}$'), created_at timestamptz not null default now(),
 unique(id,user_id)
);
create table public.transactions (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
 account_id uuid not null, destination_account_id uuid,
 kind text not null check(kind in ('income','expense','transfer')),
 amount numeric(16,2) not null check(amount>0), occurred_on date not null,
 description text not null check(length(description) between 1 and 240), category text not null check(length(category) between 1 and 60),
 source text not null default 'manual' check(source in ('manual','pdf','gmail')),
 source_key text not null, reversal_of uuid references public.transactions(id),
 created_at timestamptz not null default now(), unique(user_id,source,source_key),
 foreign key(account_id,user_id) references public.accounts(id,user_id),
 foreign key(destination_account_id,user_id) references public.accounts(id,user_id),
 check((kind='transfer') = (destination_account_id is not null)), check(account_id<>destination_account_id)
);
create index transactions_period on public.transactions(user_id,occurred_on desc,id);
create table public.budgets (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
 month date not null check(extract(day from month)=1), category text not null check(length(category) between 1 and 60),
 currency text not null check(currency in ('DOP','USD')), amount numeric(16,2) not null check(amount>0),
 unique(user_id,month,category,currency)
);
create table public.goals (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
 name text not null check(length(name) between 1 and 100), currency text not null check(currency in ('DOP','USD')),
 target_amount numeric(16,2) not null check(target_amount>0), target_date date not null,
 unique(id,user_id)
);
create table public.contributions (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
 goal_id uuid not null, amount numeric(16,2) not null check(amount>0), idempotency_key uuid not null,
 created_at timestamptz not null default now(), unique(user_id,idempotency_key),
 foreign key(goal_id,user_id) references public.goals(id,user_id) on delete cascade
);

create function public.admin_has(roles text[]) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.admin_roles where user_id=auth.uid() and role=any(roles));
$$;
create function public.trial_active() returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.trials where user_id=auth.uid() and expires_at>now() and not suspended);
$$;

create function public.initialize_user() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.email_confirmed_at is not null and (TG_OP='INSERT' or old.email_confirmed_at is null) then
   if new.raw_user_meta_data->'accepted_terms' is distinct from 'true'::jsonb then
    raise exception 'terms consent required';
   end if;
   insert into public.profiles(id,first_name,last_name,phone) values(new.id,
    left(coalesce(new.raw_user_meta_data->>'first_name',''),80),left(coalesce(new.raw_user_meta_data->>'last_name',''),80),
    left(coalesce(new.raw_user_meta_data->>'phone',''),30)) on conflict do nothing;
   insert into public.trials(user_id,started_at,expires_at)
    select new.id,now(),now()+make_interval(days=>trial_days) from public.system_settings on conflict do nothing;
   insert into public.audit_events(actor_id,subject_id,action) values(new.id,new.id,'account.verified');
 end if;
 return new;
end; $$;
create trigger user_verified after insert or update of email_confirmed_at on auth.users for each row execute function public.initialize_user();

alter table public.profiles enable row level security;
alter table public.admin_roles enable row level security;
alter table public.trials enable row level security;
alter table public.system_settings enable row level security;
alter table public.appointments enable row level security;
alter table public.audit_events enable row level security;
create policy own_profile on public.profiles for select to authenticated using(id=auth.uid());
create policy update_profile on public.profiles for update to authenticated using(id=auth.uid()) with check(id=auth.uid());
grant update(template,methods,onboarding_completed) on public.profiles to authenticated;
create policy own_role on public.admin_roles for select to authenticated using(user_id=auth.uid());
create policy read_trials on public.trials for select to authenticated using(user_id=auth.uid() or public.admin_has(array['support','operator','owner']));
create policy read_settings on public.system_settings for select to authenticated using(public.admin_has(array['owner','operator']));
create policy change_settings on public.system_settings for update to authenticated using(public.admin_has(array['owner'])) with check(public.admin_has(array['owner']));
grant update(trial_days) on public.system_settings to authenticated;
create policy manage_appointments on public.appointments for select to authenticated using(public.admin_has(array['support','operator','owner']));
create policy update_appointments on public.appointments for update to authenticated using(public.admin_has(array['support','operator','owner'])) with check(public.admin_has(array['support','operator','owner']));
grant update(status,scheduled_at,outcome) on public.appointments to authenticated;
create policy audit_read on public.audit_events for select to authenticated using(public.admin_has(array['operator','owner']) or subject_id=auth.uid());

do $$ declare t text; begin
 foreach t in array array['accounts','transactions','budgets','goals','contributions'] loop
  execute format('alter table public.%I enable row level security',t);
  execute format('create policy own_read on public.%I for select to authenticated using(user_id=auth.uid())',t);
 end loop;
 foreach t in array array['accounts','budgets','goals','contributions'] loop
  execute format('create policy own_insert on public.%I for insert to authenticated with check(user_id=auth.uid() and public.trial_active())',t);
 end loop;
end $$;

-- Write financial movements only through the atomic function. Amounts are decimal.
create function public.create_transaction(p jsonb) returns public.transactions language plpgsql security definer set search_path='' as $$
declare a public.accounts; b public.accounts; result public.transactions;
begin
 if not public.trial_active() then raise exception 'trial inactive' using errcode='42501'; end if;
 select * into a from public.accounts where id=(p->>'account_id')::uuid and user_id=auth.uid();
 if a.id is null then raise exception 'account denied' using errcode='42501'; end if;
 if p->>'kind'='transfer' then
  select * into b from public.accounts where id=(p->>'destination_account_id')::uuid and user_id=auth.uid();
  if b.id is null or b.id=a.id or a.currency<>b.currency then raise exception 'invalid destination'; end if;
 end if;
 insert into public.transactions(user_id,account_id,destination_account_id,kind,amount,occurred_on,description,category,source,source_key)
 values(auth.uid(),a.id,b.id,p->>'kind',(p->>'amount')::numeric,(p->>'occurred_on')::date,p->>'description',p->>'category','manual',p->>'idempotency_key')
 on conflict(user_id,source,source_key) do nothing returning * into result;
 if result.id is null then
  select * into result from public.transactions where user_id=auth.uid() and source='manual' and source_key=p->>'idempotency_key';
  if result.account_id<>a.id or result.destination_account_id is distinct from b.id or result.kind<>p->>'kind'
   or result.amount<>(p->>'amount')::numeric or result.occurred_on<>(p->>'occurred_on')::date
   or result.description<>p->>'description' or result.category<>p->>'category' then
   raise exception 'idempotency key reused with different data' using errcode='23505';
  end if;
 end if;
 return result;
end; $$;

create function public.edit_manual(p_id uuid, p jsonb) returns public.transactions language plpgsql security definer set search_path='' as $$
declare result public.transactions;
begin
 if not public.trial_active() then raise exception 'trial inactive' using errcode='42501'; end if;
 -- Account and transfer endpoints stay immutable; replace by delete/create to preserve consistency.
 update public.transactions set amount=(p->>'amount')::numeric, occurred_on=(p->>'occurred_on')::date,
 description=p->>'description',category=p->>'category'
 where id=p_id and user_id=auth.uid() and source='manual'
 and account_id=(p->>'account_id')::uuid and kind=p->>'kind'
 and destination_account_id is not distinct from (p->>'destination_account_id')::uuid returning * into result;
 if result.id is null then raise exception 'movement denied' using errcode='42501'; end if;
 insert into public.audit_events(actor_id,subject_id,action,details) values(auth.uid(),auth.uid(),'transaction.edited',jsonb_build_object('id',p_id));
 return result;
end; $$;

create function public.delete_manual(p_id uuid) returns void language plpgsql security definer set search_path='' as $$
begin
 if not public.trial_active() then raise exception 'trial inactive' using errcode='42501'; end if;
 delete from public.transactions where id=p_id and user_id=auth.uid() and source='manual';
 if not found then raise exception 'movement denied' using errcode='42501'; end if;
 insert into public.audit_events(actor_id,subject_id,action,details) values(auth.uid(),auth.uid(),'transaction.deleted',jsonb_build_object('id',p_id));
end; $$;

create function public.reclassify(p_id uuid,p_category text) returns void language plpgsql security definer set search_path='' as $$
begin
 if not public.trial_active() then raise exception 'trial inactive' using errcode='42501'; end if;
 update public.transactions set category=p_category where id=p_id and user_id=auth.uid();
 if not found then raise exception 'movement denied' using errcode='42501'; end if;
end; $$;

create function public.request_appointment(p jsonb) returns uuid language plpgsql security definer set search_path='' as $$
declare result uuid;
begin
 if (p->>'consent')::boolean is distinct from true or (p->>'preferred_at')::timestamptz<now() then raise exception 'invalid request'; end if;
 -- Serialize per email so concurrent requests cannot bypass quota.
 perform pg_advisory_xact_lock(hashtextextended(lower(p->>'email'),0));
 if (select count(*) from public.appointments where lower(email)=lower(p->>'email') and created_at>now()-interval '1 day')>=3 then
  raise exception 'daily limit reached';
 end if;
 insert into public.appointments(name,email,phone,modality,preferred_at)
 values(p->>'name',lower(p->>'email'),p->>'phone',p->>'modality',(p->>'preferred_at')::timestamptz) returning id into result;
 return result;
end; $$;

create function public.extend_trial(p_user_id uuid,p_days integer,p_reason text) returns void language plpgsql security definer set search_path='' as $$
begin
 if not public.admin_has(array['operator','owner']) then raise exception 'denied' using errcode='42501'; end if;
 if p_days not between 1 and 365 or length(p_reason) not between 5 and 240 then raise exception 'invalid extension'; end if;
 update public.trials set expires_at=greatest(expires_at,now())+make_interval(days=>p_days) where user_id=p_user_id;
 if not found then raise exception 'user not found'; end if;
 insert into public.audit_events(actor_id,subject_id,action,details) values(auth.uid(),p_user_id,'trial.extended',jsonb_build_object('days',p_days,'reason',p_reason));
end; $$;

create function public.delete_my_data() returns void language plpgsql security definer set search_path='' as $$
begin
 -- Auth identity stays so deleting records cannot reset the trial. Revoke Gmail before calling.
 delete from public.contributions where user_id=auth.uid();
 delete from public.goals where user_id=auth.uid();
 delete from public.budgets where user_id=auth.uid();
 update public.transactions set reversal_of=null where user_id=auth.uid();
 delete from public.transactions where user_id=auth.uid();
 delete from public.accounts where user_id=auth.uid();
 update public.profiles set first_name='',last_name='',phone='',onboarding_completed=false where id=auth.uid();
 insert into public.audit_events(actor_id,subject_id,action) values(auth.uid(),auth.uid(),'data.deleted');
end; $$;

-- Explicit least privilege: Supabase defaults may otherwise grant broader column writes.
revoke all on all tables in schema public from anon, authenticated;
grant select on public.profiles,public.admin_roles,public.trials,public.system_settings,public.audit_events,public.appointments,public.accounts,public.transactions,public.budgets,public.goals,public.contributions to authenticated;
grant insert on public.accounts,public.budgets,public.goals,public.contributions to authenticated;
grant update(template,methods,onboarding_completed) on public.profiles to authenticated;
grant update(trial_days) on public.system_settings to authenticated;
grant update(status,scheduled_at,outcome) on public.appointments to authenticated;
revoke execute on all functions in schema public from public,anon,authenticated;
grant execute on function public.admin_has(text[]),public.trial_active(),public.create_transaction(jsonb),public.edit_manual(uuid,jsonb),public.delete_manual(uuid),public.reclassify(uuid,text),public.extend_trial(uuid,integer,text),public.delete_my_data() to authenticated;
grant execute on function public.request_appointment(jsonb) to anon,authenticated;

create function public.audit_operation() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if TG_TABLE_NAME='appointments' then
  insert into public.audit_events(actor_id,action,details) values(auth.uid(),'appointment.updated',jsonb_build_object('id',new.id,'status',new.status));
 else
  insert into public.audit_events(actor_id,action,details) values(auth.uid(),'settings.updated',jsonb_build_object('trial_days',new.trial_days));
 end if;
 return new;
end; $$;
revoke execute on function public.audit_operation() from public,anon,authenticated;
create trigger audit_appointment after update on public.appointments for each row execute function public.audit_operation();
create trigger audit_settings after update on public.system_settings for each row execute function public.audit_operation();
