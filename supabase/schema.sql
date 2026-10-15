-- ============================================================
-- Kasi — personal finance tracker
-- Run this once in Supabase: Dashboard → SQL Editor → New query → paste → Run.
-- Safe to re-run: everything uses IF NOT EXISTS / OR REPLACE.
-- ============================================================

create extension if not exists pgcrypto;

-- ---------- settings (one row per user) ----------
create table if not exists settings (
  user_id       uuid primary key default auth.uid() references auth.users on delete cascade,
  display_name  text,
  payday_day    int  not null default 25 check (payday_day between 1 and 28),
  currency      text not null default 'LKR',
  ingest_token  text not null default encode(gen_random_bytes(18), 'hex') unique,
  created_at    timestamptz not null default now()
);

-- ---------- accounts ----------
create table if not exists accounts (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null default auth.uid() references auth.users on delete cascade,
  name          text not null,
  bank          text,                 -- COMBANK, SAMPATH, HNB, NTB, BOC, PEOPLES, CASH ...
  last4         text,                 -- last 4 digits; several allowed, comma-separated (account + its cards)
  type          text not null default 'bank' check (type in ('bank','credit','cash','wallet')),
  balance       numeric(14,2),
  balance_at    timestamptz,
  credit_limit  numeric(14,2),        -- credit cards: lets us turn "available balance" into amount owed
  color         text,
  archived      boolean not null default false,
  created_at    timestamptz not null default now()
);

-- ---------- categories ----------
create table if not exists categories (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null default auth.uid() references auth.users on delete cascade,
  name          text not null,
  icon          text not null default '📦',
  color         text not null default '#8b949e',
  kind          text not null default 'expense' check (kind in ('expense','income','transfer')),
  sort          int  not null default 0,
  archived      boolean not null default false,
  created_at    timestamptz not null default now()
);

-- ---------- raw SMS inbox (written by the phone forwarder) ----------
create table if not exists raw_sms (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null default auth.uid() references auth.users on delete cascade,
  sender        text,
  body          text not null,
  received_at   timestamptz not null default now(),
  status        text not null default 'new' check (status in ('new','parsed','ignored','failed','dismissed')),
  note          text,
  created_at    timestamptz not null default now()
);
alter table accounts add column if not exists credit_limit numeric(14,2);
alter table raw_sms alter column user_id set default auth.uid();

create index if not exists raw_sms_user_status on raw_sms(user_id, status);

-- ---------- transactions ----------
create table if not exists transactions (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null default auth.uid() references auth.users on delete cascade,
  account_id    uuid references accounts on delete set null,
  category_id   uuid references categories on delete set null,
  amount        numeric(14,2) not null check (amount >= 0),
  direction     text not null check (direction in ('debit','credit')),
  occurred_at   timestamptz not null default now(),
  merchant      text,
  note          text,
  source        text not null default 'manual' check (source in ('sms','manual')),
  raw_sms_id    uuid unique references raw_sms on delete set null,
  needs_review  boolean not null default false,
  currency      text not null default 'LKR',
  created_at    timestamptz not null default now()
);
create index if not exists tx_user_time on transactions(user_id, occurred_at desc);

-- ---------- auto-categorisation rules ----------
create table if not exists rules (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null default auth.uid() references auth.users on delete cascade,
  pattern       text not null,          -- lower-case text the merchant must contain
  category_id   uuid not null references categories on delete cascade,
  rename_to     text,                   -- optional clean merchant name
  created_at    timestamptz not null default now(),
  unique (user_id, pattern)
);

-- ---------- budgets ----------
create table if not exists budgets (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null default auth.uid() references auth.users on delete cascade,
  name          text not null,
  amount        numeric(14,2) not null check (amount > 0),
  category_ids  uuid[] not null default '{}',
  period        text not null default 'cycle' check (period in ('cycle','week','year')),
  active        boolean not null default true,
  created_at    timestamptz not null default now()
);

-- ---------- subscriptions / recurring bills ----------
create table if not exists subscriptions (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null default auth.uid() references auth.users on delete cascade,
  name          text not null,
  amount        numeric(14,2) not null,
  currency      text not null default 'LKR',
  cycle         text not null default 'monthly' check (cycle in ('weekly','monthly','yearly')),
  next_date     date not null,
  icon          text not null default '🔁',
  match         text,                   -- merchant text that marks it paid automatically
  category_id   uuid references categories on delete set null,
  active        boolean not null default true,
  created_at    timestamptz not null default now()
);

-- ---------- investments ----------
create table if not exists investments (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null default auth.uid() references auth.users on delete cascade,
  type          text not null check (type in ('fd','stock','unit_trust','gold','other')),
  name          text not null,
  institution   text,
  units         numeric(18,6),          -- shares / units / grams of gold
  cost          numeric(14,2) not null default 0,  -- total amount invested
  price         numeric(14,4),          -- current price per unit / per gram
  price_at      timestamptz,
  rate          numeric(6,3),           -- FD annual interest %
  start_date    date,
  maturity_date date,
  notes         text,
  closed        boolean not null default false,
  created_at    timestamptz not null default now()
);

-- ============================================================
-- Row level security: every table is private to its owner.
-- ============================================================
do $$
declare t text;
begin
  foreach t in array array['settings','accounts','categories','raw_sms','transactions','rules','budgets','subscriptions','investments']
  loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists owner_all on %I', t);
    execute format('create policy owner_all on %I for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid())', t);
  end loop;
end $$;

-- ============================================================
-- SMS ingest endpoint for the phone (MacroDroid).
-- Called with the public (anon) key + your secret ingest token.
-- OTPs / verification codes are dropped here and never stored.
-- ============================================================
-- A message is sensitive only if it carries an actual code (bank alerts often end with
-- "Do not share OTP", which must NOT drop the transaction). Mirrors isSensitive() in the app.
create or replace function kasi_is_sensitive(p_body text) returns boolean
language sql immutable as $$
  select p_body ~* '(otp|one[ -]?time ?(password|pin|code)?|verification ?code|security ?code|passcode|auth(entication)? ?code)[\s\S]{0,90}?(\mis\M|:|=)\s*\d{4,8}\M(?![.,]\d)'
      or p_body ~* '(otp|one[ -]?time password)\s*[:=-]?\s*\d{4,8}\M(?![.,]\d)'
      or p_body ~* '\m\d{4,8}\M\s*(is|as) (your|the) (otp|one[ -]?time|verification|security|pin|password|code)'
$$;

create or replace function ingest_sms(p_token text, p_sender text, p_body text)
returns text
language plpgsql security definer set search_path = public as $$
declare uid uuid;
begin
  select user_id into uid from settings where ingest_token = p_token;
  if uid is null then
    raise exception 'invalid token' using errcode = '28000';
  end if;
  if p_body is null or length(trim(p_body)) = 0 then
    return 'empty';
  end if;
  if kasi_is_sensitive(p_body) then
    return 'ignored';
  end if;
  -- Only money messages are kept: personal texts and promos without an amount are never stored.
  if p_body !~* '(\mlkr|\mslr|\mrs\.?|\musd|us\$|\meur|\mgbp|\maud|\msgd|\minr|\maed)\s*[:.]?\s*[0-9]'
     and p_body !~* '[0-9](\.[0-9]{1,2})?\s*(lkr|usd)\M' then
    return 'ignored';
  end if;
  -- de-duplicate: same sender + body within 10 minutes
  if exists (select 1 from raw_sms where user_id = uid and body = p_body
             and coalesce(sender,'') = coalesce(p_sender,'')
             and received_at > now() - interval '10 minutes') then
    return 'duplicate';
  end if;
  insert into raw_sms(user_id, sender, body) values (uid, p_sender, left(p_body, 2000));
  return 'ok';
end $$;

-- Raw-body variant: POST text/plain, token + sender in headers
--   x-kasi-token: <token>     x-sms-sender: <sender>
create or replace function ingest_sms_raw(text)
returns text
language plpgsql security definer set search_path = public as $$
declare h json := coalesce(current_setting('request.headers', true), '{}')::json;
begin
  return ingest_sms(h->>'x-kasi-token', h->>'x-sms-sender', $1);
end $$;

revoke all on function ingest_sms(text,text,text) from public;
revoke all on function ingest_sms_raw(text) from public;
grant execute on function ingest_sms(text,text,text) to anon, authenticated;
grant execute on function ingest_sms_raw(text) to anon, authenticated;

-- ============================================================
-- Live sync between phone and laptop.
-- ============================================================
do $$
declare t text;
begin
  foreach t in array array['accounts','categories','raw_sms','transactions','rules','budgets','subscriptions','investments','settings']
  loop
    begin
      execute format('alter publication supabase_realtime add table %I', t);
    exception when duplicate_object then null;
    end;
  end loop;
end $$;
