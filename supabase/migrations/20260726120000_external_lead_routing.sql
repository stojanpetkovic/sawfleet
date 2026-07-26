-- Per-source-domain routing of external leads to specific contractors/truck owners.
-- Configured standing partner lists (not territory-based) — when an external lead
-- arrives from a routed domain, the configured accounts see it unblurred in their
-- own dashboard and can accept it for free (no credit deduction).

create table public.external_lead_routing (
  id uuid primary key default gen_random_uuid(),
  source_domain text not null unique,
  enabled boolean not null default true,
  contractor_ids uuid[] not null default '{}',   -- values = contractors.user_id
  truck_owner_ids uuid[] not null default '{}',  -- values = truck_owners.id
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.external_lead_routing enable row level security;

create policy external_lead_routing_admin_all on public.external_lead_routing
  for all using (is_admin()) with check (is_admin());

alter table public.external_leads
  add column if not exists claimed_by_type text check (claimed_by_type in ('contractor','truck_owner')),
  add column if not exists claimed_by_id uuid,
  add column if not exists claimed_at timestamptz;

create index if not exists external_leads_source_domain_status_idx on public.external_leads (source_domain, status);

-- Helper functions (SECURITY DEFINER, same pattern as is_admin()) — needed because
-- external_lead_routing itself is admin-only via RLS. A policy on external_leads
-- that queries external_lead_routing directly would have that subquery ALSO subject
-- to external_lead_routing's own RLS, silently returning nothing for non-admins.
-- Routing the membership check through a SECURITY DEFINER function bypasses that.
create or replace function public.is_contractor_routed_for_domain(p_source_domain text)
returns boolean
language sql
security definer
set search_path to 'public'
as $$
  select exists (
    select 1 from public.external_lead_routing r
    join public.contractors c on c.user_id = auth.uid() and c.status = 'active'
    where r.source_domain = p_source_domain
      and r.enabled = true
      and c.user_id = any(r.contractor_ids)
  );
$$;

create or replace function public.is_truck_owner_routed_for_domain(p_source_domain text)
returns boolean
language sql
security definer
set search_path to 'public'
as $$
  select exists (
    select 1 from public.external_lead_routing r
    join public.truck_owners o on o.id = auth.uid() and o.status = 'approved'
    where r.source_domain = p_source_domain
      and r.enabled = true
      and o.id = any(r.truck_owner_ids)
  );
$$;

-- Additive SELECT policies: a routed contractor/truck owner can see external_leads
-- rows for their assigned source_domain (excluding terminal statuses). These OR
-- together with the existing admin ALL policy — nothing existing is narrowed.
create policy external_leads_contractor_routed_select on public.external_leads
  for select using (
    status not in ('closed','rejected','published')
    and public.is_contractor_routed_for_domain(source_domain)
  );

create policy external_leads_truck_owner_routed_select on public.external_leads
  for select using (
    status not in ('closed','rejected','published')
    and public.is_truck_owner_routed_for_domain(source_domain)
  );

-- Free (no credit deduction) atomic accept RPCs — first caller among the routed
-- list wins. Mirror claim_lead/apply_for_truck_lead's SECURITY DEFINER + snake_case
-- exception convention, but deliberately never touch credit_settings/credit_transactions.

create or replace function public.accept_external_lead(p_external_lead_id uuid)
returns public.external_leads
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_contractor_id uuid;
  v_domain text;
  v_row public.external_leads;
begin
  select user_id into v_contractor_id
  from public.contractors
  where user_id = auth.uid() and status = 'active';

  if v_contractor_id is null then
    raise exception 'not_an_active_contractor';
  end if;

  select source_domain into v_domain
  from public.external_leads
  where id = p_external_lead_id;

  if v_domain is null then
    raise exception 'lead_not_found';
  end if;

  if not exists (
    select 1 from public.external_lead_routing r
    where r.source_domain = v_domain
      and r.enabled = true
      and v_contractor_id = any(r.contractor_ids)
  ) then
    raise exception 'not_authorized_for_domain';
  end if;

  update public.external_leads
     set status = 'accepted',
         claimed_by_type = 'contractor',
         claimed_by_id = v_contractor_id,
         claimed_at = now()
   where id = p_external_lead_id
     and claimed_by_id is null
     and status not in ('closed','rejected','published')
  returning * into v_row;

  if v_row.id is null then
    raise exception 'already_accepted';
  end if;

  return v_row;
end;
$$;

create or replace function public.accept_external_lead_truck(p_external_lead_id uuid)
returns public.external_leads
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_owner_id uuid;
  v_domain text;
  v_row public.external_leads;
begin
  select id into v_owner_id
  from public.truck_owners
  where id = auth.uid() and status = 'approved';

  if v_owner_id is null then
    raise exception 'not_an_approved_truck_owner';
  end if;

  select source_domain into v_domain
  from public.external_leads
  where id = p_external_lead_id;

  if v_domain is null then
    raise exception 'lead_not_found';
  end if;

  if not exists (
    select 1 from public.external_lead_routing r
    where r.source_domain = v_domain
      and r.enabled = true
      and v_owner_id = any(r.truck_owner_ids)
  ) then
    raise exception 'not_authorized_for_domain';
  end if;

  update public.external_leads
     set status = 'accepted',
         claimed_by_type = 'truck_owner',
         claimed_by_id = v_owner_id,
         claimed_at = now()
   where id = p_external_lead_id
     and claimed_by_id is null
     and status not in ('closed','rejected','published')
  returning * into v_row;

  if v_row.id is null then
    raise exception 'already_accepted';
  end if;

  return v_row;
end;
$$;

grant execute on function public.accept_external_lead(uuid) to authenticated;
grant execute on function public.accept_external_lead_truck(uuid) to authenticated;
