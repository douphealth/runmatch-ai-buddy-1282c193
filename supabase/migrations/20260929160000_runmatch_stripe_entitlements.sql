-- RunMatch Pro entitlements.
-- Public clients never read/write this table directly. Only Edge Functions using
-- SUPABASE_SERVICE_ROLE_KEY may access it; RLS stays enabled with no policies.

create table if not exists public.runmatch_entitlements (
  purchase_token uuid primary key,
  stripe_customer_id text,
  stripe_session_id text unique,
  stripe_payment_intent_id text,
  stripe_subscription_id text unique,
  stripe_price_id text not null,
  mode text not null check (mode in ('payment', 'subscription')),
  status text not null default 'pending',
  email text,
  result_slug text,
  amount_total bigint,
  currency text,
  current_period_end timestamptz,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists runmatch_entitlements_customer_idx
  on public.runmatch_entitlements (stripe_customer_id);

create index if not exists runmatch_entitlements_subscription_idx
  on public.runmatch_entitlements (stripe_subscription_id);

create index if not exists runmatch_entitlements_email_idx
  on public.runmatch_entitlements (lower(email));

alter table public.runmatch_entitlements enable row level security;

create or replace function public.set_runmatch_entitlements_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_runmatch_entitlements_updated_at on public.runmatch_entitlements;
create trigger set_runmatch_entitlements_updated_at
before update on public.runmatch_entitlements
for each row execute function public.set_runmatch_entitlements_updated_at();

comment on table public.runmatch_entitlements is
  'Server-only RunMatch Pro payment/subscription entitlements keyed by an anonymous purchase token.';
