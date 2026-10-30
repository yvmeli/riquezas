-- Read-only project/schema inspection. Do not query financial rows or credentials.
select current_database() as database_name, current_user as database_role;

select n.nspname as schema_name, c.relname as object_name,
       c.relkind as object_kind, c.relrowsecurity as rls_enabled
from pg_class c join pg_namespace n on n.oid=c.relnamespace
where n.nspname in ('public','owl_private') and c.relkind in ('r','p','v')
order by n.nspname,c.relname;

select schemaname,tablename,policyname,roles,cmd
from pg_policies where schemaname in ('public','owl_private')
order by schemaname,tablename,policyname;

select exists(select 1 from information_schema.schemata where schema_name='supabase_migrations') as migration_history_available;

select n.nspname as schema_name,p.proname as function_name,pg_get_function_identity_arguments(p.oid) as arguments
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname='public' and p.proname in ('admin_has','trial_active','initialize_user','create_transaction','edit_manual','delete_manual','reclassify','request_appointment','extend_trial','delete_my_data','audit_operation','remember_category')
order by p.proname;

select t.tgname as trigger_name,p.proname as function_name
from pg_trigger t join pg_class c on c.oid=t.tgrelid
join pg_namespace n on n.oid=c.relnamespace join pg_proc p on p.oid=t.tgfoid
where n.nspname='auth' and c.relname='users' and not t.tgisinternal;
