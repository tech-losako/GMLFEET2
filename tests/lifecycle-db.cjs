/* npm install --prefix work/dbtest @electric-sql/pglite; node tests/lifecycle-db.cjs */
const {PGlite}=require('../work/dbtest/node_modules/@electric-sql/pglite');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
(async()=>{
 const db=new PGlite();
 try{
  await db.exec(`
   create role anon; create role authenticated; create role service_role;
   create schema auth; create schema storage;
   create table auth.users(id uuid primary key,email text);
   insert into auth.users values('11111111-1111-1111-1111-111111111111','admin@losakoholding.cd');
   create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
   grant usage on schema auth to authenticated,anon;grant execute on function auth.uid() to authenticated,anon;
   create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
   create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text);
   alter table storage.objects enable row level security;
   create table public.applications(id bigserial primary key,name text not null,phone text not null,address text,experience text,co_borrower_name text,co_borrower_phone text,co_borrower_address text,plan_duration_months integer,vehicle text,created_on date default current_date,created_at timestamptz default now(),status text default 'En attente',note text,license_file_name text);
   create table public.vehicles(id bigserial primary key,model text,plate text,status text,driver text,created_at timestamptz default now());
   create table public.payments(id bigserial primary key,driver_name text,amount numeric,paid_on date,method text,reference text,created_at timestamptz default now());
   alter table public.applications enable row level security;alter table public.vehicles enable row level security;alter table public.payments enable row level security;
   create policy "Anyone can submit applications" on public.applications for insert with check(true);
   create policy "Authenticated admins can read applications" on public.applications for select using(true);
   create policy "Authenticated admins can update applications" on public.applications for update using(true);
   create policy "Authenticated admins can manage vehicles" on public.vehicles for all using(true);
   create policy "Authenticated admins can manage payments" on public.payments for all using(true);
   create function public.rls_auto_enable() returns event_trigger language plpgsql as $$begin end$$;
  `);
  for(const name of ['20260915151421_service_applications','20260916114252_operations_dashboard','20260916133033_contracts_cashier_reconciliation','20260924094709_candidature_lifecycle'])await db.exec(read(`supabase/migrations/${name}.sql`));
  await db.exec(read('tests/candidature-lifecycle.sql'));
  assert.equal((await db.query('select count(*)::integer as n from public.applications')).rows[0].n,0,'test applications rolled back');
  assert.equal((await db.query('select count(*)::integer as n from public.contracts')).rows[0].n,0,'test contracts rolled back');
  console.log('PASS PostgreSQL: review/LOLC separation, required checks, appointment drafts, next-day first installment, owner fuel receipt, idempotent onboarding, available fleet allocation, confirmed Yango membership, RLS and nonstaff denial. All fixtures rolled back.');
 }finally{await db.close();}
})().catch(e=>{console.error(e.message,e.detail||'',e.where||'');process.exitCode=1;});
