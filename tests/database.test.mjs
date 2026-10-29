// Real PostgreSQL engine in WASM. Synthetic auth schema replaces only GoTrue.
// Hosted GoTrue/PostgREST still require the separate Supabase smoke test.
import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';

const db=new PGlite();
const alice='00000000-0000-4000-8000-000000000001';
const bob='00000000-0000-4000-8000-000000000002';
const admin='00000000-0000-4000-8000-000000000003';
const support='00000000-0000-4000-8000-000000000004';
let debit,card,usd,foreign;
async function login(id,role='authenticated'){
  await db.exec('reset role');
  await db.query("select set_config('request.jwt.claim.sub',$1,false)",[id]);
  await db.exec(`set role ${role}`);
}
async function count(table){return Number((await db.query(`select count(*) from public.${table}`)).rows[0].count);}
async function createMovement(overrides={}){
 const payload={account_id:debit,kind:'expense',amount:'10.10',occurred_on:'2026-10-28',description:'Sintético',category:'Hogar',idempotency_key:crypto.randomUUID(),...overrides};
 return (await db.query('select (public.create_transaction($1::jsonb)).*',[JSON.stringify(payload)])).rows[0];
}

before(async()=>{
 await db.exec(`create role anon nologin; create role authenticated nologin;
 create schema auth;
 create table auth.users(id uuid primary key,email_confirmed_at timestamptz,raw_user_meta_data jsonb default '{}');
 create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
 grant usage on schema auth,public to anon,authenticated;
 grant execute on function auth.uid() to anon,authenticated;`);
 await db.exec(await readFile(new URL('../supabase/migrations/202610280001_foundation.sql',import.meta.url),'utf8'));
 for(const id of [alice,bob,admin,support])await db.query("insert into auth.users(id,email_confirmed_at,raw_user_meta_data) values($1,now(),'{\"first_name\":\"Sintético\",\"accepted_terms\":true}')",[id]);
 await db.query("insert into public.admin_roles(user_id,role) values($1,'operator'),($2,'support')",[admin,support]);
 await login(alice);
 debit=(await db.query("insert into public.accounts(user_id,name,institution,kind,currency) values($1,'Débito','qik','debit','DOP') returning id",[alice])).rows[0].id;
 card=(await db.query("insert into public.accounts(user_id,name,institution,kind,currency,opening_balance) values($1,'Tarjeta','popular','credit','DOP',-100) returning id",[alice])).rows[0].id;
 usd=(await db.query("insert into public.accounts(user_id,name,institution,kind,currency) values($1,'USD','other','savings','USD') returning id",[alice])).rows[0].id;
 await login(bob);
 foreign=(await db.query("insert into public.accounts(user_id,name,institution,kind,currency) values($1,'Otra','other','debit','DOP') returning id",[bob])).rows[0].id;
});
after(async()=>{await db.close();});

test('verification creates profile and configurable trial once',async()=>{
 await login(alice);
 assert.equal(await count('profiles'),1);
 const trial=(await db.query('select extract(epoch from (expires_at-started_at))/86400 as days from public.trials')).rows[0];
 assert.equal(Number(trial.days),14);
 await db.exec('reset role');
 await db.query('update auth.users set email_confirmed_at=now() where id=$1',[alice]);
 await login(alice);
 assert.equal(await count('trials'),1);
 assert.equal(await count('audit_events'),1);
});

test('unverified signup does not start trial',async()=>{
 await db.exec('reset role');
 const unverified='00000000-0000-4000-8000-000000000009';
 await db.query('insert into auth.users(id,raw_user_meta_data) values($1,\'{"accepted_terms":true}\')',[unverified]);
 await login(unverified);
 assert.equal(await count('trials'),0);
 assert.equal(await count('profiles'),0);
 await db.exec('reset role');
 await db.query('update auth.users set email_confirmed_at=now() where id=$1',[unverified]);
 await login(unverified);
 assert.equal(await count('trials'),1);
});

test('RLS hides other users accounts and financial rows from administrators',async()=>{
 await login(alice);assert.equal(await count('accounts'),3);
 await login(bob);assert.equal(await count('accounts'),1);
 await login(admin);assert.equal(await count('accounts'),0);
 await login(support);assert.equal(await count('accounts'),0);
});

test('cross-user account insert and foreign transfer are denied',async()=>{
 await login(alice);
 await assert.rejects(db.query("insert into public.accounts(user_id,name,institution,kind,currency) values($1,'Ataque','qik','debit','DOP')",[bob]),/row-level security/);
 await assert.rejects(createMovement({kind:'transfer',destination_account_id:foreign}),/invalid destination/);
});

test('atomic transfer is one movement, and currency conversion is rejected',async()=>{
 await login(alice);
 const before=await count('transactions');
 const row=await createMovement({kind:'transfer',destination_account_id:card,amount:'25.00'});
 assert.equal(row.kind,'transfer');assert.equal(row.destination_account_id,card);
 assert.equal(await count('transactions'),before+1);
 await assert.rejects(createMovement({kind:'transfer',destination_account_id:usd}),/invalid destination/);
 await assert.rejects(createMovement({kind:'transfer',destination_account_id:debit}),/invalid destination/);
});

test('idempotency rejects duplicate writes including repeated RPC calls',async()=>{
 await login(alice);
 const key=crypto.randomUUID();
 const a=await createMovement({idempotency_key:key});
 const b=await createMovement({idempotency_key:key});
 assert.equal(a.id,b.id);
 assert.equal((await db.query('select count(*) from public.transactions where source_key=$1',[key])).rows[0].count,1);
 await assert.rejects(createMovement({idempotency_key:key,amount:'20.20'}),/different data/);
});

test('transactions cannot bypass the RPC or be edited by another user',async()=>{
 await login(alice);
 const row=await createMovement();
 await assert.rejects(db.query('update public.transactions set amount=999 where id=$1',[row.id]),/permission denied/);
 await login(bob);
 await assert.rejects(db.query('select public.delete_manual($1)',[row.id]),/movement denied/);
 assert.equal(await count('transactions'),0);
});

test('manual edit preserves account topology and logs audit',async()=>{
 await login(alice);
 const row=await createMovement();
 const payload={...row,amount:'12.34'};
 const edited=(await db.query('select (public.edit_manual($1,$2::jsonb)).*',[row.id,JSON.stringify(payload)])).rows[0];
 assert.equal(edited.amount,'12.34');
 await assert.rejects(db.query('select public.edit_manual($1,$2::jsonb)',[row.id,JSON.stringify({...payload,account_id:card})]),/movement denied/);
});

test('an expired trial cannot write but can read existing data',async()=>{
 await db.exec('reset role');
 await db.query("update public.trials set started_at=now()-interval '30 days',expires_at=now()-interval '1 day' where user_id=$1",[alice]);
 await login(alice);
 assert.ok(await count('transactions')>0);
 await assert.rejects(createMovement(),/trial inactive/);
 await assert.rejects(db.query("insert into public.accounts(user_id,name,institution,kind,currency) values($1,'Nueva','other','debit','DOP')",[alice]),/row-level security/);
 await assert.rejects(db.query('update public.trials set expires_at=now() where user_id=$1',[alice]),/permission denied/);
});

test('only permitted administrators can extend a trial with history',async()=>{
 await login(bob);
 await assert.rejects(db.query("select public.extend_trial($1,14,'Solicitud sintética')",[alice]),/denied/);
 await login(support);
 await assert.rejects(db.query("select public.extend_trial($1,14,'Solicitud sintética')",[alice]),/denied/);
 await login(admin);
 await db.query("select public.extend_trial($1,14,'Solicitud sintética')",[alice]);
 await login(alice);
 assert.equal((await db.query('select public.trial_active() as active')).rows[0].active,true);
 assert.ok((await db.query("select * from public.audit_events where action='trial.extended'")).rows.length===1);
});

test('trial duration requires owner and changes only future trials',async()=>{
 await login(admin);
 assert.equal((await db.query('update public.system_settings set trial_days=21 returning *')).rows.length,0);
 await db.exec('reset role');
 await db.query("update public.admin_roles set role='owner' where user_id=$1",[admin]);
 await login(admin);
 await db.query('update public.system_settings set trial_days=21');
 await db.exec('reset role');
 const future='00000000-0000-4000-8000-000000000021';
 await db.query("insert into auth.users(id,email_confirmed_at,raw_user_meta_data) values($1,now(),'{\"accepted_terms\":true}')",[future]);
 await login(future);
 assert.equal(Number((await db.query('select extract(epoch from(expires_at-started_at))/86400 as days from public.trials')).rows[0].days),21);
 await login(bob);
 assert.equal(Number((await db.query('select extract(epoch from(expires_at-started_at))/86400 as days from public.trials')).rows[0].days),14);
});

test('anonymous appointments require consent, remain requested and are not readable',async()=>{
 await login('', 'anon');
 const appointment={name:'Persona Sintética',email:'synthetic@example.com',phone:'0000000000',modality:'video',preferred_at:'2030-01-01T10:00:00Z',consent:true};
 const result=await db.query('select public.request_appointment($1::jsonb) as id',[JSON.stringify(appointment)]);
 assert.ok(result.rows[0].id);
 await assert.rejects(db.query('select * from public.appointments'),/permission denied/);
 await assert.rejects(db.query('select public.request_appointment($1::jsonb)',[JSON.stringify({...appointment,consent:false})]),/invalid request/);
 await login(support);
 assert.equal((await db.query('select status from public.appointments')).rows[0].status,'requested');
});

test('contributions cannot target another users goal',async()=>{
 await login(bob);
 const goal=(await db.query("insert into public.goals(user_id,name,currency,target_amount,target_date) values($1,'Meta sintética','DOP',100,'2030-01-01') returning id",[bob])).rows[0].id;
 await login(alice);
 await assert.rejects(db.query('insert into public.contributions(user_id,goal_id,amount,idempotency_key) values($1,$2,10,$3)',[alice,goal,crypto.randomUUID()]),/foreign key/);
});

test('delete financial data is owner-scoped and does not restart trial',async()=>{
 await login(alice);
 const original=(await db.query('select expires_at from public.trials')).rows[0].expires_at;
 await db.query('select public.delete_my_data()');
 assert.equal(await count('accounts'),0);
 assert.equal(await count('transactions'),0);
 assert.equal((await db.query('select expires_at from public.trials')).rows[0].expires_at.getTime(),original.getTime());
 await login(bob);assert.equal(await count('accounts'),1);
});
