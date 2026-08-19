alter table public.profiles
  add column if not exists avatar_url text,
  add column if not exists learner_level text not null default 'beginner'
    check (learner_level in ('beginner', 'intermediate', 'advanced')),
  add column if not exists goals text[] not null default '{}',
  add column if not exists languages text[] not null default '{}',
  add column if not exists frameworks text[] not null default '{}',
  add column if not exists ide text,
  add column if not exists teaching_style text not null default 'guided'
    check (teaching_style in ('guided', 'collaborative', 'concise')),
  add column if not exists pace text not null default 'balanced'
    check (pace in ('slow', 'balanced', 'fast')),
  add column if not exists accessibility jsonb not null default '{}'::jsonb,
  add column if not exists primary_model text,
  add column if not exists helper_model text,
  add column if not exists helper_enabled boolean not null default true,
  add column if not exists diagnostics_opt_in boolean not null default false,
  add column if not exists notification_preferences jsonb not null default '{}'::jsonb,
  add column if not exists minimum_age_confirmed_at timestamptz,
  add column if not exists deleted_at timestamptz,
  add column if not exists deletion_scheduled_for timestamptz;

alter table public.device_authorizations
  add column if not exists client_type text not null default 'cli'
    check (client_type in ('cli', 'desktop')),
  add column if not exists device_name text,
  add column if not exists platform text,
  add column if not exists strict_login boolean not null default false;

alter table public.account_sessions
  add column if not exists client_id text not null default 'codetutor-cli',
  add column if not exists client_type text not null default 'cli'
    check (client_type in ('cli', 'desktop', 'web')),
  add column if not exists device_name text,
  add column if not exists platform text,
  add column if not exists strict_login boolean not null default false,
  add column if not exists last_seen_at timestamptz not null default now(),
  add column if not exists idle_expires_at timestamptz,
  add column if not exists absolute_expires_at timestamptz,
  add column if not exists revoked_reason text;

create index if not exists account_sessions_user_active_idx
  on public.account_sessions (user_id, last_seen_at desc)
  where revoked_at is null;

create table if not exists public.service_keys (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  token_prefix text not null,
  token_hash text not null unique,
  scopes text[] not null default array['managed_ai:invoke', 'models:read', 'usage:read'],
  model_allowlist text[] not null default '{}',
  request_limit integer check (request_limit is null or request_limit > 0),
  request_count integer not null default 0 check (request_count >= 0),
  credit_limit_nanos bigint check (credit_limit_nanos is null or credit_limit_nanos > 0),
  cost_nanos bigint not null default 0 check (cost_nanos >= 0),
  reserved_cost_nanos bigint not null default 0 check (reserved_cost_nanos >= 0),
  expires_at timestamptz not null,
  last_used_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.service_key_reservations (
  request_id uuid primary key,
  service_key_id uuid not null references public.service_keys(id) on delete cascade,
  reserved_cost_nanos bigint not null check (reserved_cost_nanos >= 0),
  actual_cost_nanos bigint,
  status text not null default 'pending' check (status in ('pending', 'completed', 'released')),
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create index if not exists service_keys_user_active_idx
  on public.service_keys (user_id, created_at desc)
  where revoked_at is null;

create table if not exists public.account_deletion_requests (
  user_id uuid primary key references auth.users(id) on delete cascade,
  status text not null default 'scheduled' check (status in ('scheduled', 'cancelled', 'completed')),
  scheduled_for timestamptz not null,
  requested_at timestamptz not null default now(),
  cancelled_at timestamptz,
  completed_at timestamptz
);

create table if not exists public.account_audit_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  actor_user_id uuid references auth.users(id) on delete set null,
  event_type text not null,
  target_id text,
  reason text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists account_audit_events_user_created_idx
  on public.account_audit_events (user_id, created_at desc);

create table if not exists public.fraud_signals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  signal_type text not null,
  signal_hash text,
  risk_score integer not null default 0 check (risk_score between 0 and 100),
  metadata jsonb not null default '{}'::jsonb,
  expires_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists fraud_signals_user_created_idx
  on public.fraud_signals (user_id, created_at desc);

create table if not exists public.admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('support', 'billing', 'security', 'superadmin')),
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.admin_audit_events (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid not null references auth.users(id) on delete restrict,
  actor_role text not null,
  action text not null,
  target_user_id uuid references auth.users(id) on delete set null,
  target_id text,
  reason text not null check (char_length(reason) >= 3),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.mfa_recovery_codes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  code_hash text not null unique,
  used_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.managed_ai_credit_grants
  drop constraint if exists managed_ai_credit_grants_pack_id_check;
alter table public.managed_ai_credit_grants
  add constraint managed_ai_credit_grants_pack_id_check check (pack_id in ('5', '10', '25', 'admin'));

create or replace function public.admin_adjust_managed_ai_credit(
  p_user_id uuid,
  p_delta_nanos bigint,
  p_reference text
)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_remaining bigint := abs(p_delta_nanos);
  v_take bigint;
  v_grant record;
begin
  if p_delta_nanos = 0 then return 0; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_user_id::text, 0));
  if p_delta_nanos > 0 then
    insert into public.managed_ai_credit_grants
      (id, user_id, stripe_checkout_session_id, pack_id, original_nanos, remaining_nanos, expires_at)
    values
      (gen_random_uuid(), p_user_id, 'admin:' || p_reference, 'admin', p_delta_nanos, p_delta_nanos, now() + interval '12 months');
    return p_delta_nanos;
  end if;
  for v_grant in
    select id, remaining_nanos from public.managed_ai_credit_grants
    where user_id = p_user_id and status = 'active' and expires_at > now() and remaining_nanos > 0
    order by expires_at, created_at for update
  loop
    exit when v_remaining = 0;
    v_take := least(v_remaining, v_grant.remaining_nanos);
    update public.managed_ai_credit_grants
      set remaining_nanos = remaining_nanos - v_take, updated_at = now()
      where id = v_grant.id;
    v_remaining := v_remaining - v_take;
  end loop;
  return -(abs(p_delta_nanos) - v_remaining);
end;
$$;

create or replace function public.reserve_service_key_usage(
  p_service_key_id uuid,
  p_request_id uuid,
  p_model text,
  p_reserved_cost_nanos bigint
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_key public.service_keys%rowtype;
begin
  select * into v_key
  from public.service_keys
  where id = p_service_key_id
  for update;

  if v_key.id is null or v_key.revoked_at is not null or v_key.expires_at <= now() then
    return jsonb_build_object('ok', false, 'error', 'service_key_invalid');
  end if;
  if not ('managed_ai:invoke' = any(v_key.scopes)) then
    return jsonb_build_object('ok', false, 'error', 'service_key_scope');
  end if;
  if cardinality(v_key.model_allowlist) > 0 and not (p_model = any(v_key.model_allowlist)) then
    return jsonb_build_object('ok', false, 'error', 'service_key_model');
  end if;
  if v_key.request_limit is not null and v_key.request_count >= v_key.request_limit then
    return jsonb_build_object('ok', false, 'error', 'service_key_request_limit');
  end if;
  if v_key.credit_limit_nanos is not null
    and v_key.cost_nanos + v_key.reserved_cost_nanos + p_reserved_cost_nanos > v_key.credit_limit_nanos then
    return jsonb_build_object('ok', false, 'error', 'service_key_credit_limit');
  end if;

  insert into public.service_key_reservations
    (request_id, service_key_id, reserved_cost_nanos)
  values
    (p_request_id, p_service_key_id, greatest(0, p_reserved_cost_nanos));

  update public.service_keys
    set request_count = request_count + 1,
        reserved_cost_nanos = reserved_cost_nanos + greatest(0, p_reserved_cost_nanos),
        last_used_at = now()
    where id = p_service_key_id;

  return jsonb_build_object('ok', true);
end;
$$;

create or replace function public.finalize_service_key_usage(
  p_service_key_id uuid,
  p_request_id uuid,
  p_actual_cost_nanos bigint,
  p_status text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_reservation public.service_key_reservations%rowtype;
begin
  select * into v_reservation
  from public.service_key_reservations
  where request_id = p_request_id and service_key_id = p_service_key_id
  for update;

  if v_reservation.request_id is null or v_reservation.status <> 'pending' then return; end if;

  update public.service_key_reservations
    set status = case when p_status = 'completed' then 'completed' else 'released' end,
        actual_cost_nanos = case when p_status = 'completed' then greatest(0, p_actual_cost_nanos) else 0 end,
        completed_at = now()
    where request_id = p_request_id;

  update public.service_keys
    set reserved_cost_nanos = greatest(0, reserved_cost_nanos - v_reservation.reserved_cost_nanos),
        cost_nanos = cost_nanos + case when p_status = 'completed' then greatest(0, p_actual_cost_nanos) else 0 end,
        last_used_at = now()
    where id = p_service_key_id;
end;
$$;

alter table public.service_keys enable row level security;
alter table public.service_key_reservations enable row level security;
alter table public.account_deletion_requests enable row level security;
alter table public.account_audit_events enable row level security;
alter table public.fraud_signals enable row level security;
alter table public.admin_users enable row level security;
alter table public.admin_audit_events enable row level security;
alter table public.mfa_recovery_codes enable row level security;

revoke all on public.service_keys, public.service_key_reservations, public.account_deletion_requests,
  public.account_audit_events, public.fraud_signals, public.admin_users, public.admin_audit_events,
  public.mfa_recovery_codes
  from public, anon, authenticated;
grant select, insert, update, delete on public.service_keys, public.service_key_reservations,
  public.account_deletion_requests, public.account_audit_events, public.fraud_signals,
  public.admin_users, public.mfa_recovery_codes to service_role;
grant select, insert on public.admin_audit_events to service_role;

create policy service_keys_no_client_access on public.service_keys
  for all to anon, authenticated using (false) with check (false);
create policy service_key_reservations_no_client_access on public.service_key_reservations
  for all to anon, authenticated using (false) with check (false);
create policy account_deletion_requests_no_client_access on public.account_deletion_requests
  for all to anon, authenticated using (false) with check (false);
create policy account_audit_events_no_client_access on public.account_audit_events
  for all to anon, authenticated using (false) with check (false);
create policy fraud_signals_no_client_access on public.fraud_signals
  for all to anon, authenticated using (false) with check (false);
create policy admin_users_no_client_access on public.admin_users
  for all to anon, authenticated using (false) with check (false);
create policy admin_audit_events_no_client_access on public.admin_audit_events
  for all to anon, authenticated using (false) with check (false);
create policy mfa_recovery_codes_no_client_access on public.mfa_recovery_codes
  for all to anon, authenticated using (false) with check (false);

revoke all on function public.reserve_service_key_usage(uuid, uuid, text, bigint)
  from public, anon, authenticated;
revoke all on function public.finalize_service_key_usage(uuid, uuid, bigint, text)
  from public, anon, authenticated;
grant execute on function public.reserve_service_key_usage(uuid, uuid, text, bigint) to service_role;
grant execute on function public.finalize_service_key_usage(uuid, uuid, bigint, text) to service_role;
revoke all on function public.admin_adjust_managed_ai_credit(uuid, bigint, text) from public, anon, authenticated;
grant execute on function public.admin_adjust_managed_ai_credit(uuid, bigint, text) to service_role;

create or replace function public.prevent_admin_audit_mutation()
returns trigger language plpgsql set search_path = '' as $$
begin
  raise exception 'admin audit events are immutable';
end;
$$;

drop trigger if exists admin_audit_events_immutable on public.admin_audit_events;
create trigger admin_audit_events_immutable
  before update or delete on public.admin_audit_events
  for each row execute function public.prevent_admin_audit_mutation();
