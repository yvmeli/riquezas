-- Additive domain preparation. No existing financial rows or Auth users are changed.
create table public.institutions (
 code text primary key check(code in ('qik','popular')),
 name text not null,
 email_parser_verified boolean not null default false,
 pdf_parser_verified boolean not null default false
);
insert into public.institutions(code,name) values ('qik','Qik'),('popular','Banco Popular Dominicano');

create table public.categories (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 name text not null check(length(name) between 1 and 60),
 kind text not null check(kind in ('income','expense')),
 unique(user_id,name,kind)
);

create table public.bank_connections (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 provider text not null check(provider='gmail'),
 status text not null default 'pending' check(status in ('pending','active','error','revoked')),
 consented_at timestamptz, revoked_at timestamptz, last_sync_at timestamptz,
 created_at timestamptz not null default now(), unique(id,user_id),
 unique(user_id,provider),
 check(status<>'active' or consented_at is not null)
);

-- Outside exposed PostgREST schemas; plaintext tokens never belong in public.
create schema if not exists owl_private;
create table owl_private.connection_tokens (
 connection_id uuid primary key,
 user_id uuid not null,
 encrypted_tokens text not null check(length(encrypted_tokens) between 1 and 16384),
 updated_at timestamptz not null default now(),
 foreign key(connection_id,user_id) references public.bank_connections(id,user_id) on delete cascade
);
alter table owl_private.connection_tokens enable row level security;
revoke all on owl_private.connection_tokens from public,anon,authenticated;

create table public.imports (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 account_id uuid not null,
 institution text not null references public.institutions(code),
 source text not null check(source in ('pdf','gmail')),
 document_sha256 text check(document_sha256 ~ '^[a-f0-9]{64}$'),
 status text not null default 'pending_review' check(status in ('pending_review','confirmed','rejected','failed')),
 created_at timestamptz not null default now(), confirmed_at timestamptz,
 unique(id,user_id),
 foreign key(account_id,user_id) references public.accounts(id,user_id),
 unique(user_id,account_id,document_sha256)
);
create table public.import_rows (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 import_id uuid not null,
 row_number integer not null check(row_number>0),
 occurred_on date, description text check(length(description)<=240),
 amount numeric(16,2) check(amount>0), currency text check(currency in ('DOP','USD')),
 kind text check(kind in ('income','expense','transfer')),
 reference text check(length(reference)<=120),
 source_key text not null check(length(source_key) between 1 and 240),
 needs_review boolean not null default true,
 foreign key(import_id,user_id) references public.imports(id,user_id) on delete cascade,
 unique(import_id,row_number),unique(user_id,source_key)
);
create table public.sync_runs (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 connection_id uuid not null,
 status text not null default 'queued' check(status in ('queued','running','completed','failed','cancelled')),
 attempts integer not null default 0 check(attempts between 0 and 10),
 error_code text check(error_code in ('invalid_format','untrusted_sender','trial_expired','token_expired','upstream_retry','permanent_failure')),
 created_at timestamptz not null default now(), started_at timestamptz, finished_at timestamptz,
 foreign key(connection_id,user_id) references public.bank_connections(id,user_id) on delete cascade
);
create index import_rows_owner on public.import_rows(user_id,import_id);
create index sync_runs_owner on public.sync_runs(user_id,created_at desc);

alter table public.institutions enable row level security;
create policy read_institutions on public.institutions for select to anon,authenticated using(true);
revoke all on public.institutions,public.categories,public.bank_connections,public.imports,public.import_rows,public.sync_runs from anon,authenticated;
grant select on public.institutions to anon,authenticated;

do $$ declare t text; begin
 foreach t in array array['categories','bank_connections','imports','import_rows','sync_runs'] loop
  execute format('alter table public.%I enable row level security',t);
  execute format('create policy own_read on public.%I for select to authenticated using(user_id=auth.uid())',t);
  execute format('grant select,insert on public.%I to authenticated',t);
 end loop;
end $$;
create policy own_insert on public.categories for insert to authenticated with check(user_id=auth.uid() and public.trial_active());
create policy pending_connection on public.bank_connections for insert to authenticated
 with check(user_id=auth.uid() and public.trial_active() and status='pending' and consented_at is null and revoked_at is null and last_sync_at is null);
create policy pending_import on public.imports for insert to authenticated
 with check(user_id=auth.uid() and public.trial_active() and status='pending_review' and confirmed_at is null);
create policy own_draft on public.import_rows for insert to authenticated
 with check(user_id=auth.uid() and public.trial_active() and needs_review and exists(
  select 1 from public.imports i where i.id=import_id and i.user_id=auth.uid() and i.status='pending_review'));
create policy queue_sync on public.sync_runs for insert to authenticated
 with check(user_id=auth.uid() and public.trial_active() and status='queued' and attempts=0 and error_code is null and started_at is null and finished_at is null
 and exists(select 1 from public.bank_connections c where c.id=connection_id and c.user_id=auth.uid() and c.status='active' and c.consented_at is not null));

-- Keep the private catalog aligned with the existing free-form categorization.
insert into public.categories(user_id,name,kind)
 select distinct user_id,category,kind from public.transactions where kind in ('income','expense') on conflict do nothing;
insert into public.categories(user_id,name,kind)
 select distinct user_id,category,'expense' from public.budgets on conflict do nothing;
create function public.remember_category() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if TG_TABLE_NAME='budgets' then
  insert into public.categories(user_id,name,kind) values(new.user_id,new.category,'expense') on conflict do nothing;
 elsif new.kind in ('income','expense') then
  insert into public.categories(user_id,name,kind) values(new.user_id,new.category,new.kind) on conflict do nothing;
 end if;
 return new;
end; $$;
revoke execute on function public.remember_category() from public,anon,authenticated;
create trigger remember_transaction_category after insert or update of category on public.transactions for each row execute function public.remember_category();
create trigger remember_budget_category after insert on public.budgets for each row execute function public.remember_category();

-- Keep owner-only financial deletion complete as domains are added. Active OAuth
-- must be revoked by the backend before its credentials/connection are erased.
create or replace function public.delete_my_data() returns void language plpgsql security definer set search_path='' as $$
begin
 if exists(select 1 from public.bank_connections where user_id=auth.uid() and status='active') then
  raise exception 'revoke active connections before deleting data' using errcode='42501';
 end if;
 delete from public.bank_connections where user_id=auth.uid();
 delete from public.imports where user_id=auth.uid();
 delete from public.categories where user_id=auth.uid();
 delete from public.contributions where user_id=auth.uid();
 delete from public.goals where user_id=auth.uid();
 delete from public.budgets where user_id=auth.uid();
 update public.transactions set reversal_of=null where user_id=auth.uid();
 delete from public.transactions where user_id=auth.uid();
 delete from public.accounts where user_id=auth.uid();
 update public.profiles set first_name='',last_name='',phone='',onboarding_completed=false where id=auth.uid();
 insert into public.audit_events(actor_id,subject_id,action) values(auth.uid(),auth.uid(),'data.deleted');
end; $$;
